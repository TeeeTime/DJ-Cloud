use std::fs;
use std::path::Path;

/// Moves an existing library folder's contents to a new location so that changing the folder
/// never leaves a stale copy of already-downloaded files behind, and never requires re-syncing
/// to repopulate the new location. Pure filesystem move — the sync index (`.djcloud-sync.json`,
/// keyed by playlist id, storing only relative folder names — see `sync.rs`) and every file's
/// embedded track-id tag stay valid at the new path completely unchanged.
pub fn relocate(old: &Path, new: &Path) -> Result<(), String> {
    if old == new || !old.exists() {
        return Ok(());
    }

    if let Some(parent) = new.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    if !new.exists() {
        // Fast path: an atomic rename when possible (same volume). Falls back to a recursive
        // copy + delete for a cross-volume move, where `rename` can't work.
        if fs::rename(old, new).is_ok() {
            return Ok(());
        }
        copy_dir_recursive(old, new)?;
        fs::remove_dir_all(old).map_err(|err| err.to_string())?;
        return Ok(());
    }

    // The destination already exists (e.g. the user picked an existing folder) — merge each
    // top-level entry into it instead of overwriting anything. An entry left behind (name
    // collision) is reported rather than silently dropped or silently overwritten.
    let mut collisions = Vec::new();
    for entry in fs::read_dir(old).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let target = new.join(entry.file_name());

        if target.exists() {
            collisions.push(entry.file_name().to_string_lossy().into_owned());
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

    if collisions.is_empty() {
        // Old folder is now empty — remove it so nothing "dead" is left behind.
        let _ = fs::remove_dir(old);
        Ok(())
    } else {
        Err(format!(
            "Moved everything except {} item(s) that already existed at the new location, left in place at {}: {}",
            collisions.len(),
            old.display(),
            collisions.join(", ")
        ))
    }
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
    fn renames_whole_tree_to_new_path() {
        let dir = tempfile_dir();
        let old = dir.join("old");
        let new = dir.join("nested").join("new");
        fs::create_dir_all(old.join("Playlist A")).unwrap();
        fs::write(old.join("Playlist A").join("track.mp3"), b"data").unwrap();
        fs::write(old.join(".djcloud-sync.json"), b"{}").unwrap();

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
        fs::create_dir_all(&new).unwrap();

        relocate(&old, &new).unwrap();

        assert!(!old.exists());
        assert!(new.join("Playlist A").join("track.mp3").exists());

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn leaves_colliding_entries_behind_instead_of_overwriting() {
        let dir = tempfile_dir();
        let old = dir.join("old");
        let new = dir.join("new");
        fs::create_dir_all(old.join("Playlist A")).unwrap();
        fs::write(old.join("Playlist A").join("old-track.mp3"), b"old").unwrap();
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
