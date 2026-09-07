use std::fs;
use std::path::Path;

use crate::sync;

/// Moves an existing library folder's contents to a new location so that changing the folder
/// never leaves a stale copy of already-downloaded files behind, and never requires re-syncing
/// to repopulate the new location. Only moves entries DJ Cloud itself created — every playlist
/// folder currently in the sync index, plus the index file (`.djcloud-sync.json`) itself, per
/// `sync::managed_top_level_names`. Anything else at the top level of `old` (a user's own file or
/// folder placed alongside the synced playlists) is left exactly where it is; `old` is only
/// removed once it no longer has anything left in it. Every moved file's embedded track-id tag
/// stays valid at the new path completely unchanged — this is a pure filesystem move.
pub fn relocate(old: &Path, new: &Path) -> Result<(), String> {
    if old == new || !old.exists() {
        return Ok(());
    }

    if let Some(parent) = new.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let managed = sync::managed_top_level_names(old);

    fs::create_dir_all(new).map_err(|err| err.to_string())?;

    // Merge each managed top-level entry into the destination. An entry left behind because the
    // destination already has something of that name (a genuine collision) is reported rather
    // than silently dropped or silently overwritten. Entries DJ Cloud didn't create are skipped
    // entirely — never moved, never reported — since they're simply not ours to touch.
    let mut collisions = Vec::new();
    for entry in fs::read_dir(old).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();

        if !managed.contains(&name) {
            continue;
        }

        let target = new.join(entry.file_name());

        if target.exists() {
            collisions.push(name);
            continue;
        }

        if fs::rename(entry.path(), &target).is_err() {
            if entry.path().is_dir() {
                copy_dir_recursive(&entry.path(), &target)?;
                fs::remove_dir_all(entry.path()).map_err(|err| err.to_string())?;
            } else {
                fs::copy(entry.path(), &target).map_err(|err| err.to_string())?;
                fs::remove_file(entry.path()).map_err(|err| err.to_string())?;
            }
        }
    }

    if !collisions.is_empty() {
        return Err(format!(
            "Moved everything except {} item(s) that already existed at the new location, left in place at {}: {}",
            collisions.len(),
            old.display(),
            collisions.join(", ")
        ));
    }

    // Old folder is only removed once it's actually empty — if it still has unmanaged entries
    // (or, in principle, was never fully readable above), this simply no-ops rather than failing,
    // since leaving the user's own files behind in their original location is the whole point.
    let _ = fs::remove_dir(old);
    Ok(())
}

fn copy_dir_recursive(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|err| err.to_string())?;

    for entry in fs::read_dir(from).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let dest = to.join(entry.file_name());
        let file_type = entry.file_type().map_err(|err| err.to_string())?;

        if file_type.is_dir() {
            copy_dir_recursive(&entry.path(), &dest)?;
        } else {
            fs::copy(entry.path(), &dest).map_err(|err| err.to_string())?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn moves_managed_entries_to_new_path() {
        let dir = tempfile_dir();
        let old = dir.join("old");
        let new = dir.join("nested").join("new");
        fs::create_dir_all(old.join("Playlist A")).unwrap();
        fs::write(old.join("Playlist A").join("track.mp3"), b"data").unwrap();
        write_sync_index(&old, &[("1", "Playlist A")]);

        relocate(&old, &new).unwrap();

        assert!(!old.exists());
        assert!(new.join("Playlist A").join("track.mp3").exists());
        assert!(new.join(".djcloud-sync.json").exists());

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn merges_into_existing_empty_destination() {
        let dir = tempfile_dir();
        let old = dir.join("old");
        let new = dir.join("new");
        fs::create_dir_all(old.join("Playlist A")).unwrap();
        fs::write(old.join("Playlist A").join("track.mp3"), b"data").unwrap();
        write_sync_index(&old, &[("1", "Playlist A")]);
        fs::create_dir_all(&new).unwrap();

        relocate(&old, &new).unwrap();

        assert!(!old.exists());
        assert!(new.join("Playlist A").join("track.mp3").exists());

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn leaves_colliding_managed_entries_behind_instead_of_overwriting() {
        let dir = tempfile_dir();
        let old = dir.join("old");
        let new = dir.join("new");
        fs::create_dir_all(old.join("Playlist A")).unwrap();
        fs::write(old.join("Playlist A").join("old-track.mp3"), b"old").unwrap();
        write_sync_index(&old, &[("1", "Playlist A")]);
        fs::create_dir_all(new.join("Playlist A")).unwrap();
        fs::write(new.join("Playlist A").join("existing.mp3"), b"existing").unwrap();

        let result = relocate(&old, &new);

        assert!(result.is_err());
        // The colliding "Playlist A" folder stays behind untouched, rather than being merged
        // or overwritten, since this test's "old" and "new" both already have a "Playlist A".
        assert!(old.join("Playlist A").join("old-track.mp3").exists());
        assert!(new.join("Playlist A").join("existing.mp3").exists());

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn leaves_unmanaged_entries_untouched() {
        let dir = tempfile_dir();
        let old = dir.join("old");
        let new = dir.join("new");
        fs::create_dir_all(old.join("Playlist A")).unwrap();
        fs::write(old.join("Playlist A").join("track.mp3"), b"data").unwrap();
        write_sync_index(&old, &[("1", "Playlist A")]);
        // A folder and a loose file DJ Cloud never created, sitting alongside the synced
        // playlist — not in the sync index, so relocate must leave both exactly where they are.
        fs::create_dir_all(old.join("My Own Mixes")).unwrap();
        fs::write(old.join("My Own Mixes").join("mix.mp3"), b"mine").unwrap();
        fs::write(old.join("notes.txt"), b"personal notes").unwrap();

        relocate(&old, &new).unwrap();

        assert!(new.join("Playlist A").join("track.mp3").exists());
        // The old folder is still there (not deleted, since it's not empty), and the foreign
        // entries never moved.
        assert!(old.exists());
        assert!(old.join("My Own Mixes").join("mix.mp3").exists());
        assert!(old.join("notes.txt").exists());
        assert!(!new.join("My Own Mixes").exists());
        assert!(!new.join("notes.txt").exists());

        fs::remove_dir_all(&dir).ok();
    }

    fn write_sync_index(library_folder: &Path, playlists: &[(&str, &str)]) {
        let entries: Vec<String> = playlists
            .iter()
            .map(|(id, folder_name)| format!(r#""{id}":{{"folder_name":"{folder_name}"}}"#))
            .collect();
        let content = format!(r#"{{"version":1,"playlists":{{{}}}}}"#, entries.join(","));
        fs::write(library_folder.join(".djcloud-sync.json"), content).unwrap();
    }

    fn tempfile_dir() -> std::path::PathBuf {
        let dir = std::env::temp_dir()
            .join(format!("djcloud-relocate-test-{}", std::process::id()))
            .join(uuid_like());
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn uuid_like() -> String {
        use std::time::{SystemTime, UNIX_EPOCH};
        format!(
            "{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        )
    }
}
