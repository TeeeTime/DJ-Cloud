use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::auth;
use crate::http;
use crate::settings;
use crate::tags;

const SYNC_INDEX_FILE: &str = ".djcloud-sync.json";
const PLAYLISTS_PAGE_SIZE: u32 = 200;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Playlist {
    id: i64,
    name: String,
    owner_username: String,
    subscribed: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrackSummary {
    id: i64,
    file_format: String,
    size_bytes: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Page<T> {
    content: Vec<T>,
    has_next: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct SyncIndex {
    version: u32,
    /// Playlist id (as a string, since JSON object keys must be strings) -> its local folder name.
    /// Keyed by id rather than name so a playlist rename doesn't orphan the folder on next sync.
    playlists: HashMap<String, PlaylistEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PlaylistEntry {
    folder_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncProgressEvent {
    phase: &'static str,
    files_completed: usize,
    files_total: usize,
    current_playlist: Option<String>,
    current_file: Option<String>,
    bytes_downloaded: u64,
    bytes_total: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSummary {
    pub playlists_synced: usize,
    pub downloaded: usize,
    pub failed: usize,
}

struct MissingTrack {
    playlist_folder: PathBuf,
    playlist_name: String,
    track_id: i64,
    file_format: String,
    size_bytes: u64,
}

#[tauri::command]
pub async fn sync_library(app: AppHandle) -> Result<SyncSummary, String> {
    let auth_info = auth::get_auth_token_internal(&app)?.ok_or("Not logged in")?;
    let library_folder = settings::get_settings(app.clone())?
        .library_folder
        .ok_or("No library folder set")?;
    let library_folder = PathBuf::from(library_folder);

    let client = Client::new();
    let token = auth_info.token.as_str();

    let playlists: Vec<Playlist> = http::get_json(&client, token, "/api/playlists").await?;
    let relevant: Vec<&Playlist> = playlists
        .iter()
        .filter(|playlist| playlist.subscribed || playlist.owner_username == auth_info.username)
        .collect();

    let mut index = load_sync_index(&library_folder);

    let _ = app.emit(
        "sync-progress",
        SyncProgressEvent {
            phase: "scanning",
            files_completed: 0,
            files_total: 0,
            current_playlist: None,
            current_file: None,
            bytes_downloaded: 0,
            bytes_total: None,
        },
    );

    // Resolve (or recover/create) every relevant playlist's folder, saving the index after each
    // mapping so a mid-sync crash doesn't lose folder-identity information already decided. Each
    // playlist's remote track ids are fetched first since a lost/corrupted index recovery (see
    // `resolve_playlist_folder`) needs them to identify which existing folder is really its own.
    let mut missing = Vec::new();
    for playlist in &relevant {
        let remote_tracks = fetch_all_tracks(&client, token, playlist.id).await?;
        let remote_ids: HashSet<i64> = remote_tracks.iter().map(|track| track.id).collect();

        let folder = resolve_playlist_folder(&library_folder, &mut index, playlist, &remote_ids)?;
        save_sync_index(&library_folder, &index)?;

        let local_ids = local_track_ids(&folder);
        for track in remote_tracks {
            if !local_ids.contains(&track.id) {
                missing.push(MissingTrack {
                    playlist_folder: folder.clone(),
                    playlist_name: playlist.name.clone(),
                    track_id: track.id,
                    file_format: track.file_format,
                    size_bytes: track.size_bytes,
                });
            }
        }
    }

    // Fail fast, before downloading anything, if the whole sync clearly won't fit — cheaper and
    // clearer than letting it fail partway through one track at a time.
    let needed: u64 = missing.iter().map(|item| item.size_bytes).sum();
    if needed > 0 {
        let available = fs4::available_space(&library_folder).map_err(|err| err.to_string())?;
        if needed > available {
            return Err(format!(
                "Not enough disk space to sync: need {}, only {} available",
                format_bytes(needed),
                format_bytes(available)
            ));
        }
    }

    let total = missing.len();
    let mut downloaded = 0usize;
    let mut failed = 0usize;

    for (index_in_batch, item) in missing.into_iter().enumerate() {
        let result = download_track(&app, &client, token, &item, index_in_batch, total).await;
        match result {
            Ok(()) => downloaded += 1,
            Err(err) => {
                failed += 1;
                eprintln!(
                    "Failed to download track {} for playlist \"{}\": {err}",
                    item.track_id, item.playlist_name
                );
            }
        }
    }

    let summary = SyncSummary {
        playlists_synced: relevant.len(),
        downloaded,
        failed,
    };

    let _ = app.emit(
        "sync-progress",
        SyncProgressEvent {
            phase: "done",
            files_completed: downloaded,
            files_total: total,
            current_playlist: None,
            current_file: None,
            bytes_downloaded: 0,
            bytes_total: None,
        },
    );

    Ok(summary)
}

fn load_sync_index(library_folder: &Path) -> SyncIndex {
    let path = library_folder.join(SYNC_INDEX_FILE);
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or(SyncIndex {
            version: 1,
            playlists: HashMap::new(),
        })
}

fn save_sync_index(library_folder: &Path, index: &SyncIndex) -> Result<(), String> {
    let path = library_folder.join(SYNC_INDEX_FILE);
    let content = serde_json::to_string_pretty(index).map_err(|err| err.to_string())?;
    fs::write(path, content).map_err(|err| err.to_string())
}

/// Every top-level name inside `library_folder` that DJ Cloud created — every playlist folder
/// currently in the sync index, plus the index file itself. `relocate` uses this to know what
/// it's allowed to move without sweeping up a user's own files/folders that happen to live
/// alongside the synced playlists.
pub(crate) fn managed_top_level_names(library_folder: &Path) -> HashSet<String> {
    let index = load_sync_index(library_folder);
    let mut names: HashSet<String> = index
        .playlists
        .into_values()
        .map(|entry| entry.folder_name)
        .collect();
    names.insert(SYNC_INDEX_FILE.to_string());
    names
}

/// Looks up (or recovers/assigns) the local folder for a playlist, keyed by its id so a rename
/// reuses the existing folder instead of creating a duplicate. A brand-new mapping first checks
/// whether an existing, unclaimed folder already holds this playlist's tracks (see
/// `find_recovered_folder` — covers a lost/corrupted sync index) before falling back to a
/// sanitized, collision-safe folder name derived from the playlist's current name.
fn resolve_playlist_folder(
    library_folder: &Path,
    index: &mut SyncIndex,
    playlist: &Playlist,
    remote_track_ids: &HashSet<i64>,
) -> Result<PathBuf, String> {
    let key = playlist.id.to_string();

    if let Some(entry) = index.playlists.get(&key) {
        let folder = library_folder.join(&entry.folder_name);
        fs::create_dir_all(&folder).map_err(|err| err.to_string())?;
        return Ok(folder);
    }

    let used_names: HashSet<String> = index
        .playlists
        .values()
        .map(|entry| entry.folder_name.clone())
        .collect();

    let folder_name = match find_recovered_folder(library_folder, &used_names, remote_track_ids) {
        Some(recovered) => recovered,
        None => unique_folder_name(&sanitize_folder_name(&playlist.name), &used_names),
    };
    let folder = library_folder.join(&folder_name);
    fs::create_dir_all(&folder).map_err(|err| err.to_string())?;

    index.playlists.insert(
        key,
        PlaylistEntry {
            folder_name: folder_name.clone(),
        },
    );

    Ok(folder)
}

/// Scans `library_folder`'s existing top-level subdirectories, not already claimed by another
/// index entry, for one whose already-tagged tracks overlap with this playlist's remote track
/// ids — evidence it's this playlist's folder from a prior sync whose index mapping was lost
/// (e.g. `.djcloud-sync.json` got deleted or corrupted). Best effort: picks the subdirectory with
/// the largest overlap, if any overlap exists at all, rather than requiring a perfect match.
fn find_recovered_folder(
    library_folder: &Path,
    used_names: &HashSet<String>,
    remote_track_ids: &HashSet<i64>,
) -> Option<String> {
    if remote_track_ids.is_empty() {
        return None;
    }

    let entries = fs::read_dir(library_folder).ok()?;
    let mut best: Option<(String, usize)> = None;

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().into_owned();
        if used_names.contains(&name) {
            continue;
        }

        let overlap = local_track_ids(&entry.path())
            .intersection(remote_track_ids)
            .count();
        if overlap == 0 {
            continue;
        }

        let is_better = match &best {
            Some((_, best_overlap)) => overlap > *best_overlap,
            None => true,
        };
        if is_better {
            best = Some((name, overlap));
        }
    }

    best.map(|(name, _)| name)
}

fn sanitize_folder_name(name: &str) -> String {
    let cleaned = sanitize_path_component(name);

    if cleaned.is_empty() {
        "Playlist".to_string()
    } else {
        cleaned
    }
}

/// Strips characters that are invalid (or awkward) in a filesystem name. Shared by playlist
/// folder names and downloaded track filenames, since both are ultimately joined onto a disk
/// path — for filenames this also closes off a path-traversal risk, since a server-provided
/// name containing `/`/`\` could otherwise escape the intended playlist folder.
fn sanitize_path_component(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if r#"<>:"/\|?*"#.contains(c) || c.is_control() {
                '_'
            } else {
                c
            }
        })
        .collect();
    cleaned.trim().trim_end_matches(['.', ' ']).to_string()
}

fn unique_folder_name(base: &str, used: &HashSet<String>) -> String {
    if !used.contains(base) {
        return base.to_string();
    }

    let mut counter = 2;
    loop {
        let candidate = format!("{base} ({counter})");
        if !used.contains(&candidate) {
            return candidate;
        }
        counter += 1;
    }
}

/// Same idea as `unique_folder_name`, but checked against what's actually on disk in `folder`
/// rather than an index, and splits off the file extension so the disambiguating suffix lands
/// before it (`"Song (DJ Cloud).mp3"`, not `"Song.mp3 (DJ Cloud)"`). Used so a synced track never
/// overwrites a same-named file that isn't this exact track — see `download_track`.
fn unique_file_path(folder: &Path, filename: &str) -> PathBuf {
    let candidate = folder.join(filename);
    if !candidate.exists() {
        return candidate;
    }

    let (stem, ext) = split_extension(filename);
    let with_suffix = |suffix: String| match ext {
        Some(ext) => folder.join(format!("{stem} {suffix}.{ext}")),
        None => folder.join(format!("{stem} {suffix}")),
    };

    let first = with_suffix("(DJ Cloud)".to_string());
    if !first.exists() {
        return first;
    }

    let mut counter = 2;
    loop {
        let candidate = with_suffix(format!("(DJ Cloud) ({counter})"));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

fn split_extension(filename: &str) -> (&str, Option<&str>) {
    match filename.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => (stem, Some(ext)),
        _ => (filename, None),
    }
}

async fn fetch_all_tracks(
    client: &Client,
    token: &str,
    playlist_id: i64,
) -> Result<Vec<TrackSummary>, String> {
    let mut all = Vec::new();
    let mut page = 0u32;

    loop {
        let path =
            format!("/api/playlists/{playlist_id}/tracks?page={page}&size={PLAYLISTS_PAGE_SIZE}");
        let response: Page<TrackSummary> = http::get_json(client, token, &path).await?;
        let has_next = response.has_next;
        all.extend(response.content);

        if !has_next {
            break;
        }
        page += 1;
    }

    Ok(all)
}

/// Reads the embedded id tag off every mp3/wav file already in `folder` — the local half of the
/// integrity check. A file that fails to read or carries no id tag is simply not counted as
/// present, so it's treated the same as genuinely missing (and re-downloaded, harmlessly).
fn local_track_ids(folder: &Path) -> HashSet<i64> {
    let mut ids = HashSet::new();

    let Ok(entries) = fs::read_dir(folder) else {
        return ids;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Some(extension) = path.extension().and_then(|ext| ext.to_str()) else {
            continue;
        };
        if !extension.eq_ignore_ascii_case("mp3") && !extension.eq_ignore_ascii_case("wav") {
            continue;
        }

        if let Some(id) = tags::read_track_id_tag(&path) {
            ids.insert(id);
        }
    }

    ids
}

async fn download_track(
    app: &AppHandle,
    client: &Client,
    token: &str,
    item: &MissingTrack,
    index_in_batch: usize,
    total: usize,
) -> Result<(), String> {
    let path = format!("/api/tracks/{}/download", item.track_id);
    let response = http::get(client, token, &path).await?;

    let bytes_total = response.content_length();
    let filename = response
        .headers()
        .get(reqwest::header::CONTENT_DISPOSITION)
        .and_then(|value| value.to_str().ok())
        .and_then(parse_content_disposition_filename)
        .map(|name| sanitize_path_component(&name))
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| format!("track-{}.{}", item.track_id, item.file_format));

    let _ = app.emit(
        "sync-progress",
        SyncProgressEvent {
            phase: "downloading",
            files_completed: index_in_batch,
            files_total: total,
            current_playlist: Some(item.playlist_name.clone()),
            current_file: Some(filename.clone()),
            bytes_downloaded: 0,
            bytes_total,
        },
    );

    let bytes = response
        .bytes()
        .await
        .map_err(|err| format!("Could not download track {}: {err}", item.track_id))?;

    let _ = app.emit(
        "sync-progress",
        SyncProgressEvent {
            phase: "downloading",
            files_completed: index_in_batch,
            files_total: total,
            current_playlist: Some(item.playlist_name.clone()),
            current_file: Some(filename.clone()),
            bytes_downloaded: bytes.len() as u64,
            bytes_total,
        },
    );

    // Never overwrite whatever's already at this path: by construction, `download_track` only
    // ever runs for a track id that `local_track_ids` already confirmed isn't tagged in any local
    // file in this folder — so anything already sitting here isn't this track (a stale download,
    // or the user's own file) and must be left alone.
    let final_path = unique_file_path(&item.playlist_folder, &filename);
    let temp_path = item.playlist_folder.join(format!("{filename}.part"));

    // Re-check right before writing, using the exact size already in hand rather than trusting a
    // header — catches free space having been consumed by something else since the upfront total
    // check in `sync_library`.
    let available = fs4::available_space(&item.playlist_folder).map_err(|err| err.to_string())?;
    if bytes.len() as u64 > available {
        return Err(format!(
            "Not enough disk space for track {}: need {}, only {} available",
            item.track_id,
            format_bytes(bytes.len() as u64),
            format_bytes(available)
        ));
    }

    if let Err(err) = fs::write(&temp_path, &bytes) {
        // Don't leave a partial download behind for a write that failed partway through.
        let _ = fs::remove_file(&temp_path);
        return Err(err.to_string());
    }
    fs::rename(&temp_path, &final_path).map_err(|err| err.to_string())?;

    Ok(())
}

/// Human-readable `"1.2 GB"`-style rendering for disk-space error messages.
fn format_bytes(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut value = bytes as f64;
    let mut unit = 0;

    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }

    if unit == 0 {
        format!("{bytes} {}", UNITS[unit])
    } else {
        format!("{value:.1} {}", UNITS[unit])
    }
}

/// Prefers the RFC 5987 extended form (`filename*=UTF-8''...`) Spring emits alongside the plain
/// `filename="..."` fallback, falling back to the plain form if the extended one isn't present.
fn parse_content_disposition_filename(header: &str) -> Option<String> {
    if let Some(idx) = header.find("filename*=") {
        let rest = &header[idx + "filename*=".len()..];
        let value = rest.split(';').next().unwrap_or(rest).trim();
        let encoded = value
            .strip_prefix("UTF-8''")
            .or_else(|| value.strip_prefix("utf-8''"))
            .unwrap_or(value);
        if let Some(decoded) = percent_decode(encoded) {
            return Some(decoded);
        }
    }

    if let Some(idx) = header.find("filename=") {
        let rest = &header[idx + "filename=".len()..];
        let value = rest.split(';').next().unwrap_or(rest).trim();
        return Some(value.trim_matches('"').to_string());
    }

    None
}

fn percent_decode(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok()?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }

    String::from_utf8(out).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    fn tempfile_dir() -> PathBuf {
        // An atomic counter, not just a nanosecond timestamp, since tests run in parallel threads
        // within the same process and clock resolution alone isn't reliably fine enough to keep
        // two near-simultaneous calls from colliding on the same directory.
        static COUNTER: AtomicU64 = AtomicU64::new(0);

        let dir = std::env::temp_dir()
            .join(format!("djcloud-sync-test-{}", std::process::id()))
            .join(COUNTER.fetch_add(1, Ordering::Relaxed).to_string());
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn unique_file_path_returns_candidate_as_is_when_free() {
        let dir = tempfile_dir();
        assert_eq!(unique_file_path(&dir, "Song.mp3"), dir.join("Song.mp3"));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn unique_file_path_suffixes_on_collision_without_clobbering_the_extension() {
        let dir = tempfile_dir();
        fs::write(dir.join("Song.mp3"), b"someone else's file").unwrap();

        assert_eq!(
            unique_file_path(&dir, "Song.mp3"),
            dir.join("Song (DJ Cloud).mp3")
        );

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn unique_file_path_keeps_incrementing_past_a_second_collision() {
        let dir = tempfile_dir();
        fs::write(dir.join("Song.mp3"), b"one").unwrap();
        fs::write(dir.join("Song (DJ Cloud).mp3"), b"two").unwrap();

        assert_eq!(
            unique_file_path(&dir, "Song.mp3"),
            dir.join("Song (DJ Cloud) (2).mp3")
        );

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn unique_file_path_handles_a_filename_with_no_extension() {
        let dir = tempfile_dir();
        fs::write(dir.join("Song"), b"someone else's file").unwrap();

        assert_eq!(unique_file_path(&dir, "Song"), dir.join("Song (DJ Cloud)"));

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn sanitize_path_component_strips_invalid_characters() {
        assert_eq!(sanitize_path_component("Mix: A/B\\C"), "Mix_ A_B_C");
    }
}
