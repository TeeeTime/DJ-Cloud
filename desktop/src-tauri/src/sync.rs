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

    // Resolve (or create) every relevant playlist's folder up front, saving the index after each
    // new mapping so a mid-sync crash doesn't lose folder-identity information already decided.
    let mut playlist_folders = Vec::with_capacity(relevant.len());
    for playlist in &relevant {
        let folder = resolve_playlist_folder(&library_folder, &mut index, playlist)?;
        save_sync_index(&library_folder, &index)?;
        playlist_folders.push((playlist, folder));
    }

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

    let mut missing = Vec::new();
    for (playlist, folder) in &playlist_folders {
        let remote_tracks = fetch_all_tracks(&client, token, playlist.id).await?;
        let local_ids = local_track_ids(folder);

        for track in remote_tracks {
            if !local_ids.contains(&track.id) {
                missing.push(MissingTrack {
                    playlist_folder: folder.clone(),
                    playlist_name: playlist.name.clone(),
                    track_id: track.id,
                    file_format: track.file_format,
                });
            }
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

/// Looks up (or assigns) the local folder for a playlist, keyed by its id so a rename reuses the
/// existing folder instead of creating a duplicate. A brand-new mapping gets a sanitized,
/// collision-safe folder name derived from the playlist's current name.
fn resolve_playlist_folder(
    library_folder: &Path,
    index: &mut SyncIndex,
    playlist: &Playlist,
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
    let folder_name = unique_folder_name(&sanitize_folder_name(&playlist.name), &used_names);
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

fn sanitize_folder_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if r#"<>:"/\|?*"#.contains(c) || c.is_control() { '_' } else { c })
        .collect();
    let trimmed = cleaned.trim().trim_end_matches(['.', ' ']).to_string();

    if trimmed.is_empty() { "Playlist".to_string() } else { trimmed }
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

async fn fetch_all_tracks(client: &Client, token: &str, playlist_id: i64) -> Result<Vec<TrackSummary>, String> {
    let mut all = Vec::new();
    let mut page = 0u32;

    loop {
        let path = format!(
            "/api/playlists/{playlist_id}/tracks?page={page}&size={PLAYLISTS_PAGE_SIZE}"
        );
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

    let final_path = item.playlist_folder.join(&filename);
    let temp_path = item.playlist_folder.join(format!("{filename}.part"));
    fs::write(&temp_path, &bytes).map_err(|err| err.to_string())?;
    fs::rename(&temp_path, &final_path).map_err(|err| err.to_string())?;

    Ok(())
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
