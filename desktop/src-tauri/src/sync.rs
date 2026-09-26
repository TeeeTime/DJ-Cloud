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
const TRACKS_PAGE_SIZE: u32 = 200;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Playlist {
    id: i64,
    name: String,
    sync_enabled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Genre {
    id: i64,
    name: String,
    sync_enabled: bool,
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
    playlists: HashMap<String, FolderEntry>,
    /// Same idea as `playlists`, for sync-enabled genres — genre folders live in the same flat,
    /// shared directory as playlist folders (see `other_used_names`, which pools both maps
    /// together so a playlist and a genre can never silently collide on the same folder name).
    /// `#[serde(default)]` so an index file written before this field existed still parses —
    /// without it, a missing "genres" key would fail deserialization and silently reset the
    /// whole index (losing every existing playlist folder mapping) on a user's first sync after
    /// upgrading.
    #[serde(default)]
    genres: HashMap<String, FolderEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FolderEntry {
    folder_name: String,
}

impl SyncIndex {
    fn map_for(&self, kind: SourceKind) -> &HashMap<String, FolderEntry> {
        match kind {
            SourceKind::Playlist => &self.playlists,
            SourceKind::Genre => &self.genres,
        }
    }

    fn map_for_mut(&mut self, kind: SourceKind) -> &mut HashMap<String, FolderEntry> {
        match kind {
            SourceKind::Playlist => &mut self.playlists,
            SourceKind::Genre => &mut self.genres,
        }
    }
}

/// Which kind of remote collection a folder is being resolved for — lets `resolve_folder` and
/// its helpers share one implementation between playlists and genres instead of duplicating it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SourceKind {
    Playlist,
    Genre,
}

impl SourceKind {
    /// Capitalized, singular — used as the fallback folder name when sanitizing leaves nothing.
    fn default_folder_name(self) -> &'static str {
        match self {
            SourceKind::Playlist => "Playlist",
            SourceKind::Genre => "Genre",
        }
    }

    /// Lowercase noun for log/error messages.
    fn noun(self) -> &'static str {
        match self {
            SourceKind::Playlist => "playlist",
            SourceKind::Genre => "genre",
        }
    }
}

/// A minimal, kind-tagged view of one playlist or genre, just enough for folder resolution.
struct FolderSource<'a> {
    kind: SourceKind,
    id: i64,
    name: &'a str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncProgressEvent {
    phase: &'static str,
    files_completed: usize,
    files_total: usize,
    current_source: Option<String>,
    current_file: Option<String>,
    bytes_downloaded: u64,
    bytes_total: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSummary {
    pub playlists_synced: usize,
    pub genres_synced: usize,
    pub downloaded: usize,
    pub failed: usize,
}

struct MissingTrack {
    folder: PathBuf,
    source_name: String,
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

    // Sync is its own explicit per-playlist opt-in, independent of subscribing or owning — even a
    // playlist's own owner must enable it, same as anyone else.
    let playlists: Vec<Playlist> = http::get_json(&client, token, "/api/playlists").await?;
    let relevant_playlists: Vec<&Playlist> = playlists
        .iter()
        .filter(|playlist| playlist.sync_enabled)
        .collect();

    // Genres have no owner and no separate "subscribe" concept — sync is the only per-user state.
    let genres: Vec<Genre> = http::get_json(&client, token, "/api/genres").await?;
    let relevant_genres: Vec<&Genre> = genres.iter().filter(|genre| genre.sync_enabled).collect();

    let mut index = load_sync_index(&library_folder);

    // A playlist or genre that was synced before but is no longer sync-enabled (or was deleted
    // remotely — either way it's simply absent from this run's relevant set) has its previously
    // downloaded tracks removed now, before anything else runs (see `remove_stale_folders`).
    // Nothing else in this function ever revisits an index entry outside the current relevant
    // set, so skipping this would leave those files behind indefinitely.
    let relevant_playlist_ids: HashSet<i64> = relevant_playlists
        .iter()
        .map(|playlist| playlist.id)
        .collect();
    remove_stale_folders(
        &library_folder,
        &mut index,
        SourceKind::Playlist,
        &relevant_playlist_ids,
    );
    let relevant_genre_ids: HashSet<i64> = relevant_genres.iter().map(|genre| genre.id).collect();
    remove_stale_folders(
        &library_folder,
        &mut index,
        SourceKind::Genre,
        &relevant_genre_ids,
    );
    save_sync_index(&library_folder, &index)?;

    let _ = app.emit(
        "sync-progress",
        SyncProgressEvent {
            phase: "scanning",
            files_completed: 0,
            files_total: 0,
            current_source: None,
            current_file: None,
            bytes_downloaded: 0,
            bytes_total: None,
        },
    );

    // Resolve (or recover/create) every relevant playlist's and genre's folder, saving the index
    // after each mapping so a mid-sync crash doesn't lose folder-identity information already
    // decided. Each source's remote track ids are fetched first since a lost/corrupted index
    // recovery (see `resolve_folder`) needs them to identify which existing folder is really its
    // own. Playlists are resolved before genres so a genre can never "recover" a playlist's
    // folder (or vice versa) — `resolve_folder` already prevents name collisions between the two
    // regardless of order, but resolving playlists first keeps their folders stable/unaffected by
    // whatever genres happen to sync alongside them.
    let mut missing = Vec::new();
    for playlist in &relevant_playlists {
        let tracks_path = format!("/api/playlists/{}/tracks", playlist.id);
        let remote_tracks = fetch_all_tracks(&client, token, &tracks_path).await?;
        let remote_ids: HashSet<i64> = remote_tracks.iter().map(|track| track.id).collect();

        let source = FolderSource {
            kind: SourceKind::Playlist,
            id: playlist.id,
            name: &playlist.name,
        };
        let folder = resolve_folder(&library_folder, &mut index, &source, &remote_ids)?;
        save_sync_index(&library_folder, &index)?;

        cleanup_stale_part_files(&folder);

        let local_ids = local_track_ids(&folder);
        for track in remote_tracks {
            if !local_ids.contains(&track.id) {
                missing.push(MissingTrack {
                    folder: folder.clone(),
                    source_name: playlist.name.clone(),
                    track_id: track.id,
                    file_format: track.file_format,
                    size_bytes: track.size_bytes,
                });
            }
        }
    }

    for genre in &relevant_genres {
        let tracks_path = format!("/api/genres/{}/tracks", encode_path_segment(&genre.name));
        let remote_tracks = fetch_all_tracks(&client, token, &tracks_path).await?;
        let remote_ids: HashSet<i64> = remote_tracks.iter().map(|track| track.id).collect();

        let source = FolderSource {
            kind: SourceKind::Genre,
            id: genre.id,
            name: &genre.name,
        };
        let folder = resolve_folder(&library_folder, &mut index, &source, &remote_ids)?;
        save_sync_index(&library_folder, &index)?;

        cleanup_stale_part_files(&folder);

        let local_ids = local_track_ids(&folder);
        for track in remote_tracks {
            if !local_ids.contains(&track.id) {
                missing.push(MissingTrack {
                    folder: folder.clone(),
                    source_name: genre.name.clone(),
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
                    "Failed to download track {} for \"{}\": {err}",
                    item.track_id, item.source_name
                );
            }
        }
    }

    let summary = SyncSummary {
        playlists_synced: relevant_playlists.len(),
        genres_synced: relevant_genres.len(),
        downloaded,
        failed,
    };

    let _ = app.emit(
        "sync-progress",
        SyncProgressEvent {
            phase: "done",
            files_completed: downloaded,
            files_total: total,
            current_source: None,
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
            genres: HashMap::new(),
        })
}

fn save_sync_index(library_folder: &Path, index: &SyncIndex) -> Result<(), String> {
    let path = library_folder.join(SYNC_INDEX_FILE);
    let content = serde_json::to_string_pretty(index).map_err(|err| err.to_string())?;
    fs::write(path, content).map_err(|err| err.to_string())
}

/// Every top-level name inside `library_folder` that DJ Cloud created — every playlist and genre
/// folder currently in the sync index, plus the index file itself. `relocate` uses this to know
/// what it's allowed to move without sweeping up a user's own files/folders that happen to live
/// alongside the synced playlists/genres.
pub(crate) fn managed_top_level_names(library_folder: &Path) -> HashSet<String> {
    let index = load_sync_index(library_folder);
    let mut names: HashSet<String> = index
        .playlists
        .into_values()
        .map(|entry| entry.folder_name)
        .collect();
    names.extend(index.genres.into_values().map(|entry| entry.folder_name));
    names.insert(SYNC_INDEX_FILE.to_string());
    names
}

/// For every `kind` source that's no longer in `still_relevant_ids` — i.e. sync was turned off
/// for it, or it was deleted remotely, since either way it simply won't appear in the caller's
/// current relevant-ids set — removes only the files DJ Cloud itself manages inside its folder
/// (see `remove_managed_files`) and drops the index entry, so a re-sync later plugs straight back
/// into the same folder (`resolve_folder`) rather than starting fresh elsewhere. Anything else a
/// user placed in that folder is left completely untouched, and so is the folder itself unless
/// removing the managed files leaves it empty — an empty folder isn't content worth keeping
/// around. Best-effort throughout: a file that can't be removed (open/locked elsewhere,
/// permissions, etc.) is logged and left for next time.
fn remove_stale_folders(
    library_folder: &Path,
    index: &mut SyncIndex,
    kind: SourceKind,
    still_relevant_ids: &HashSet<i64>,
) {
    let stale_keys: Vec<String> = index
        .map_for(kind)
        .keys()
        .filter(|key| {
            key.parse::<i64>()
                .map(|id| !still_relevant_ids.contains(&id))
                .unwrap_or(false)
        })
        .cloned()
        .collect();

    for key in stale_keys {
        let Some(entry) = index.map_for(kind).get(&key).cloned() else {
            continue;
        };
        let folder = library_folder.join(&entry.folder_name);

        remove_managed_files(&folder);
        cleanup_stale_part_files(&folder);

        let is_empty = fs::read_dir(&folder).is_ok_and(|mut entries| entries.next().is_none());
        if is_empty {
            let _ = fs::remove_dir(&folder);
        }

        index.map_for_mut(kind).remove(&key);
    }
}

/// Deletes every file directly inside `folder` that DJ Cloud recognizes as a synced track — same
/// mp3/wav-plus-valid-id-tag test as `local_track_ids` — and leaves everything else (any other
/// extension, any file without a readable id tag, any subdirectory) exactly where it is. This is
/// the one place DJ Cloud ever removes track files, so it's what keeps "unsync" from touching
/// content it didn't put there itself.
fn remove_managed_files(folder: &Path) {
    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Some(extension) = path.extension().and_then(|ext| ext.to_str()) else {
            continue;
        };
        if !extension.eq_ignore_ascii_case("mp3") && !extension.eq_ignore_ascii_case("wav") {
            continue;
        }
        if tags::read_track_id_tag(&path).is_none() {
            continue;
        }

        if let Err(err) = fs::remove_file(&path) {
            eprintln!(
                "Could not remove no-longer-synced file \"{}\": {err}",
                path.display()
            );
        }
    }
}

/// Looks up (or plugs into/recovers/renames) the local folder for a playlist or genre, keyed by
/// its id within its own kind's map (`SyncIndex.playlists` / `SyncIndex.genres`) — but folder
/// *names* are drawn from one shared, flat namespace, since playlist and genre folders live side
/// by side in the same directory (see `other_used_names`). A brand-new mapping (this source has
/// never been synced before, or was unsynced and is being re-enabled) claims its sanitized name
/// directly, whatever already exists there — DJ Cloud only ever touches files it recognizes
/// within a folder (see `remove_managed_files`), so plugging into an already-existing folder,
/// DJ-Cloud-managed or not, never disturbs unrelated content sitting in it. That name is only
/// avoided if another *currently active* index entry already claims it (two distinct sources can
/// never share one folder); in that rare case, a lost-index recovery pass
/// (`find_recovered_folder`) is tried first, then a collision-safe suffix. An existing mapping
/// whose folder name no longer matches the source's current (sanitized) name — i.e. it was
/// renamed remotely since the last sync — is renamed on disk to match, best-effort: a rename that
/// fails (folder missing, open/locked elsewhere, etc.) keeps the old name rather than failing the
/// whole sync over one source.
fn resolve_folder(
    library_folder: &Path,
    index: &mut SyncIndex,
    source: &FolderSource,
    remote_track_ids: &HashSet<i64>,
) -> Result<PathBuf, String> {
    let key = source.id.to_string();
    let desired_name = sanitize_folder_name(source.name, source.kind.default_folder_name());

    if let Some(entry) = index.map_for(source.kind).get(&key).cloned() {
        if entry.folder_name == desired_name {
            let folder = library_folder.join(&entry.folder_name);
            fs::create_dir_all(&folder).map_err(|err| err.to_string())?;
            return Ok(folder);
        }

        let old_path = library_folder.join(&entry.folder_name);
        let used_names = other_used_names(index, source.kind, &key);
        let new_name = unique_folder_name_on_disk(&desired_name, &used_names, library_folder);

        let folder_name = if old_path.exists() {
            let new_path = library_folder.join(&new_name);
            if fs::rename(&old_path, &new_path).is_ok() {
                new_name
            } else {
                eprintln!(
                    "Could not rename {} folder \"{}\" to match renamed {} \"{}\"; keeping old name",
                    source.kind.noun(), entry.folder_name, source.kind.noun(), source.name
                );
                entry.folder_name
            }
        } else {
            // Nothing to rename — the old folder is already gone (deleted externally) — so just
            // adopt the new name going forward.
            new_name
        };

        let folder = library_folder.join(&folder_name);
        fs::create_dir_all(&folder).map_err(|err| err.to_string())?;
        index
            .map_for_mut(source.kind)
            .insert(key, FolderEntry { folder_name });
        return Ok(folder);
    }

    let used_names = other_used_names(index, source.kind, &key);
    let folder_name = if !used_names.contains(&desired_name) {
        desired_name
    } else {
        find_recovered_folder(library_folder, &used_names, remote_track_ids)
            .unwrap_or_else(|| unique_name(&desired_name, &used_names))
    };
    let folder = library_folder.join(&folder_name);
    fs::create_dir_all(&folder).map_err(|err| err.to_string())?;

    index.map_for_mut(source.kind).insert(
        key,
        FolderEntry {
            folder_name: folder_name.clone(),
        },
    );

    Ok(folder)
}

/// Every folder name already claimed by another playlist or genre in the index — the union of
/// both `SyncIndex.playlists` and `SyncIndex.genres`, except `exclude_key`'s own entry within
/// `kind`'s map, so a source being renamed doesn't see its own (about-to-change) name as "taken"
/// and needlessly pick a suffixed alternative. Pooling both maps together is what keeps a
/// playlist and a genre from ever silently colliding on (or recovering into) the same folder,
/// since both kinds' folders live flat in the same directory.
fn other_used_names(index: &SyncIndex, kind: SourceKind, exclude_key: &str) -> HashSet<String> {
    index
        .playlists
        .iter()
        .filter(|(key, _)| !(kind == SourceKind::Playlist && key.as_str() == exclude_key))
        .chain(
            index
                .genres
                .iter()
                .filter(|(key, _)| !(kind == SourceKind::Genre && key.as_str() == exclude_key)),
        )
        .map(|(_, entry)| entry.folder_name.clone())
        .collect()
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

fn sanitize_folder_name(name: &str, default: &str) -> String {
    let cleaned = sanitize_path_component(name);

    if cleaned.is_empty() {
        default.to_string()
    } else {
        cleaned
    }
}

/// Percent-encodes `value` as a single URL path segment (spaces, `&`, `/`, unicode, etc.),
/// matching the frontend's `encodeURIComponent` — needed because genre names (unlike playlist
/// ids) are arbitrary user text embedded directly in the request path, and `http::get`/`get_json`
/// do no encoding of their own. Critically, this also percent-encodes a literal `/`, so a genre
/// name containing one can't split the request into extra path segments.
fn encode_path_segment(value: &str) -> String {
    let mut url = url::Url::parse("http://djcloud.local/").expect("valid base url");
    url.path_segments_mut()
        .expect("base url can be a base")
        .push(value);
    url.path().trim_start_matches('/').to_string()
}

/// Strips characters that are invalid (or awkward) in a filesystem name. Shared by playlist
/// folder names and downloaded track filenames, since both are ultimately joined onto a disk
/// path — for filenames this also closes off a path-traversal risk, since a server-provided
/// name containing `/`/`\` could otherwise escape the intended playlist folder. Applied on every
/// platform regardless of which OS is actually running, since the stricter Windows-only rules
/// (illegal characters, reserved device names) are a harmless no-op on macOS/Linux but avoid a
/// real failure if the same library folder is ever used from Windows.
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
    let cleaned = cleaned.trim().trim_end_matches(['.', ' ']).to_string();
    avoid_windows_reserved_name(cleaned)
}

/// Windows reserves these names (case-insensitively, with or without a trailing extension) for
/// device files — `fs::create_dir_all("CON")` or writing a file named `NUL.txt` fails outright.
/// Appends a trailing underscore so a colliding name stays recognizable but is no longer reserved.
fn avoid_windows_reserved_name(name: String) -> String {
    const RESERVED: &[&str] = &[
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];

    let stem = name.split('.').next().unwrap_or(&name);
    if RESERVED
        .iter()
        .any(|reserved| stem.eq_ignore_ascii_case(reserved))
    {
        format!("{name}_")
    } else {
        name
    }
}

/// Picks a folder name based on `base`, disambiguated with a `" (2)"`-style suffix against both
/// `used` (other sources' folder names already claimed in the sync index) and whatever actually
/// exists on disk under `library_folder`. Used only when renaming an *existing* mapping's folder
/// to match a source's new (remote-renamed) name — the target name is avoided if something's
/// already sitting there, since renaming onto it would require a merge, not a plain `fs::rename`.
/// Brand-new folder resolution (`resolve_folder`'s no-prior-mapping branch) uses `unique_name`
/// instead, which intentionally skips the disk check and plugs straight into an existing folder.
fn unique_folder_name_on_disk(base: &str, used: &HashSet<String>, library_folder: &Path) -> String {
    let is_taken = |name: &str| used.contains(name) || library_folder.join(name).exists();

    if !is_taken(base) {
        return base.to_string();
    }

    let mut counter = 2;
    loop {
        let candidate = format!("{base} ({counter})");
        if !is_taken(&candidate) {
            return candidate;
        }
        counter += 1;
    }
}

/// Same idea as `unique_folder_name_on_disk`, but checks only `used` — never disk existence — so
/// a brand-new source's sanitized name is never avoided just because a folder with that name
/// happens to already exist. Only actually needed when `used` itself already contains `base`
/// (another currently-active source claims that exact name).
fn unique_name(base: &str, used: &HashSet<String>) -> String {
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

/// Same idea as `unique_folder_name_on_disk`, but splits off the file extension so the
/// disambiguating suffix lands before it (`"Song (DJ Cloud).mp3"`, not `"Song.mp3 (DJ Cloud)"`).
/// Used so a synced track never overwrites a same-named file that isn't this exact track — see
/// `download_track`.
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

/// Fetches every track summary from a paged tracks endpoint — `tracks_path` is the base path
/// (e.g. `/api/playlists/{id}/tracks` or `/api/genres/{encoded_name}/tracks`), with no query
/// string of its own, since paging params are appended here.
async fn fetch_all_tracks(
    client: &Client,
    token: &str,
    tracks_path: &str,
) -> Result<Vec<TrackSummary>, String> {
    let mut all = Vec::new();
    let mut page = 0u32;

    loop {
        let path = format!("{tracks_path}?page={page}&size={TRACKS_PAGE_SIZE}");
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

/// Removes any leftover `*.part` temp file in `folder` from a prior download that never finished
/// renaming to its final name — normally that only happens if the app was killed (crash, force
/// quit, power loss) mid-write, since `download_track` already cleans up after a write that fails
/// on its own. Safe to just discard: the track a `.part` file belongs to isn't tagged yet either
/// way, so it's already about to be re-downloaded in this same sync run. Best-effort — a folder
/// that can't be read or a file that can't be removed is simply left for next time.
fn cleanup_stale_part_files(folder: &Path) {
    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) == Some("part") {
            let _ = fs::remove_file(path);
        }
    }
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
    // `HeaderValue::to_str()` fails outright if the header contains ANY non-ASCII byte anywhere —
    // and the server's legacy `filename="..."` parameter can carry a raw non-ASCII byte (e.g. an
    // accented artist name) even though the `filename*=UTF-8''...` parameter right next to it is
    // always properly percent-encoded. Decoding lossily instead means one bad byte in the legacy
    // parameter no longer throws away a perfectly good `filename*=` alongside it.
    let filename = response
        .headers()
        .get(reqwest::header::CONTENT_DISPOSITION)
        .map(|value| String::from_utf8_lossy(value.as_bytes()).into_owned())
        .and_then(|value| parse_content_disposition_filename(&value))
        .map(|name| sanitize_path_component(&name))
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| format!("track-{}.{}", item.track_id, item.file_format));

    let _ = app.emit(
        "sync-progress",
        SyncProgressEvent {
            phase: "downloading",
            files_completed: index_in_batch,
            files_total: total,
            current_source: Some(item.source_name.clone()),
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
            current_source: Some(item.source_name.clone()),
            current_file: Some(filename.clone()),
            bytes_downloaded: bytes.len() as u64,
            bytes_total,
        },
    );

    // Never overwrite whatever's already at this path: by construction, `download_track` only
    // ever runs for a track id that `local_track_ids` already confirmed isn't tagged in any local
    // file in this folder — so anything already sitting here isn't this track (a stale download,
    // or the user's own file) and must be left alone.
    let final_path = unique_file_path(&item.folder, &filename);
    let temp_path = item.folder.join(format!("{filename}.part"));

    // Re-check right before writing, using the exact size already in hand rather than trusting a
    // header — catches free space having been consumed by something else since the upfront total
    // check in `sync_library`.
    let available = fs4::available_space(&item.folder).map_err(|err| err.to_string())?;
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

    #[test]
    fn parse_content_disposition_filename_prefers_extended_form() {
        let header = "attachment; filename=\"fallback.wav\"; filename*=UTF-8''Ti%C3%ABsto.wav";
        assert_eq!(
            parse_content_disposition_filename(header),
            Some("Tiësto.wav".to_string())
        );
    }

    #[test]
    fn parse_content_disposition_filename_falls_back_to_plain_form() {
        let header = "attachment; filename=\"plain.wav\"";
        assert_eq!(
            parse_content_disposition_filename(header),
            Some("plain.wav".to_string())
        );
    }

    /// Regression test for the actual bug: the server's legacy `filename="..."` parameter can
    /// carry a raw non-ASCII byte (e.g. Spring embedding an accented artist name directly rather
    /// than percent-encoding it), which makes `HeaderValue::to_str()` fail for the WHOLE header —
    /// even though the `filename*=UTF-8''...` parameter right next to it is always valid. Decoding
    /// the raw header bytes lossily (as `download_track` now does) instead of via `to_str()` must
    /// still recover the correct filename from `filename*=`.
    #[test]
    fn parse_content_disposition_filename_recovers_extended_form_despite_raw_byte_in_legacy_form() {
        let mut raw = Vec::new();
        raw.extend_from_slice(b"attachment; filename=\"Ti");
        raw.push(0xEB); // raw ISO-8859-1 'e-with-diaeresis' byte, not percent-encoded
        raw.extend_from_slice(b"sto.wav\"; filename*=UTF-8''Ti%C3%ABsto.wav");

        let lossy = String::from_utf8_lossy(&raw).into_owned();

        assert_eq!(
            parse_content_disposition_filename(&lossy),
            Some("Tiësto.wav".to_string())
        );
    }

    #[test]
    fn sanitize_path_component_avoids_windows_reserved_names() {
        assert_eq!(sanitize_path_component("CON"), "CON_");
        assert_eq!(sanitize_path_component("con"), "con_");
        assert_eq!(sanitize_path_component("LPT1"), "LPT1_");
        // Not reserved: only an exact (case-insensitive) match on the stem counts.
        assert_eq!(sanitize_path_component("Console"), "Console");
    }

    #[test]
    fn cleanup_stale_part_files_removes_part_files_but_leaves_others() {
        let dir = tempfile_dir();
        fs::write(dir.join("track.mp3.part"), b"partial").unwrap();
        fs::write(dir.join("track.mp3"), b"complete").unwrap();

        cleanup_stale_part_files(&dir);

        assert!(!dir.join("track.mp3.part").exists());
        assert!(dir.join("track.mp3").exists());

        fs::remove_dir_all(&dir).ok();
    }

    fn playlist_source(id: i64, name: &str) -> FolderSource<'_> {
        FolderSource {
            kind: SourceKind::Playlist,
            id,
            name,
        }
    }

    fn genre_source(id: i64, name: &str) -> FolderSource<'_> {
        FolderSource {
            kind: SourceKind::Genre,
            id,
            name,
        }
    }

    fn empty_index() -> SyncIndex {
        SyncIndex {
            version: 1,
            playlists: HashMap::new(),
            genres: HashMap::new(),
        }
    }

    /// A real, id3v2-tagged fixture (same one `tags::tests` uses) — needed here because
    /// `remove_managed_files` only recognizes a file as "ours" via a genuine, readable id tag, not
    /// just a matching extension.
    fn fixture_mp3_path() -> PathBuf {
        Path::new(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../test-fixtures/fixture.mp3"
        ))
        .to_path_buf()
    }

    #[test]
    fn remove_stale_folders_deletes_managed_file_and_the_now_empty_folder() {
        let dir = tempfile_dir();
        let folder = dir.join("Old Favorites");
        fs::create_dir_all(&folder).unwrap();
        fs::copy(fixture_mp3_path(), folder.join("track.mp3")).unwrap();

        let mut index = SyncIndex {
            playlists: HashMap::from([(
                "1".to_string(),
                FolderEntry {
                    folder_name: "Old Favorites".to_string(),
                },
            )]),
            ..empty_index()
        };

        remove_stale_folders(&dir, &mut index, SourceKind::Playlist, &HashSet::new());

        assert!(!folder.exists());
        assert!(!index.playlists.contains_key("1"));

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn remove_stale_folders_leaves_foreign_content_and_the_folder_itself_in_place() {
        let dir = tempfile_dir();
        let folder = dir.join("Old Favorites");
        fs::create_dir_all(&folder).unwrap();
        fs::copy(fixture_mp3_path(), folder.join("track.mp3")).unwrap();
        // Not a DJ-Cloud-managed file — no id tag at all — so it must survive untouched.
        fs::write(folder.join("my-own-mix.mp3"), b"not ours").unwrap();

        let mut index = SyncIndex {
            playlists: HashMap::from([(
                "1".to_string(),
                FolderEntry {
                    folder_name: "Old Favorites".to_string(),
                },
            )]),
            ..empty_index()
        };

        remove_stale_folders(&dir, &mut index, SourceKind::Playlist, &HashSet::new());

        assert!(!folder.join("track.mp3").exists());
        assert!(folder.join("my-own-mix.mp3").exists());
        // The folder itself stays too, since it's not empty — only the index mapping goes away.
        assert!(folder.exists());
        assert!(!index.playlists.contains_key("1"));

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn remove_stale_folders_keeps_folder_and_entry_for_a_still_relevant_playlist() {
        let dir = tempfile_dir();
        fs::create_dir_all(dir.join("Still Subscribed")).unwrap();

        let mut index = SyncIndex {
            playlists: HashMap::from([(
                "1".to_string(),
                FolderEntry {
                    folder_name: "Still Subscribed".to_string(),
                },
            )]),
            ..empty_index()
        };

        remove_stale_folders(&dir, &mut index, SourceKind::Playlist, &HashSet::from([1]));

        assert!(dir.join("Still Subscribed").exists());
        assert!(index.playlists.contains_key("1"));

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn remove_stale_folders_drops_the_index_entry_even_when_the_folder_is_already_gone() {
        let dir = tempfile_dir();
        // No folder created on disk — e.g. the user deleted it manually.

        let mut index = SyncIndex {
            playlists: HashMap::from([(
                "1".to_string(),
                FolderEntry {
                    folder_name: "Already Gone".to_string(),
                },
            )]),
            ..empty_index()
        };

        remove_stale_folders(&dir, &mut index, SourceKind::Playlist, &HashSet::new());

        assert!(!index.playlists.contains_key("1"));

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn remove_stale_folders_only_touches_the_given_kind() {
        let dir = tempfile_dir();
        fs::create_dir_all(dir.join("House")).unwrap();

        let mut index = SyncIndex {
            genres: HashMap::from([(
                "1".to_string(),
                FolderEntry {
                    folder_name: "House".to_string(),
                },
            )]),
            ..empty_index()
        };

        // No longer relevant for playlists — but "1" here is a genre id, so this must be a no-op.
        remove_stale_folders(&dir, &mut index, SourceKind::Playlist, &HashSet::new());

        assert!(dir.join("House").exists());
        assert!(index.genres.contains_key("1"));

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn resolve_folder_renames_local_folder_when_playlist_is_renamed_remotely() {
        let dir = tempfile_dir();
        fs::create_dir_all(dir.join("Old Name")).unwrap();
        fs::write(dir.join("Old Name").join("track.mp3"), b"data").unwrap();

        let mut index = SyncIndex {
            playlists: HashMap::from([(
                "1".to_string(),
                FolderEntry {
                    folder_name: "Old Name".to_string(),
                },
            )]),
            ..empty_index()
        };

        let source = playlist_source(1, "New Name");
        let folder = resolve_folder(&dir, &mut index, &source, &HashSet::new()).unwrap();

        assert_eq!(folder, dir.join("New Name"));
        assert!(folder.join("track.mp3").exists());
        assert!(!dir.join("Old Name").exists());
        assert_eq!(index.playlists["1"].folder_name, "New Name");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn resolve_folder_picks_a_free_name_when_rename_target_already_exists_on_disk() {
        let dir = tempfile_dir();
        fs::create_dir_all(dir.join("Old Name")).unwrap();
        // A folder DJ Cloud didn't create that happens to already occupy the desired new name.
        fs::create_dir_all(dir.join("New Name")).unwrap();

        let mut index = SyncIndex {
            playlists: HashMap::from([(
                "1".to_string(),
                FolderEntry {
                    folder_name: "Old Name".to_string(),
                },
            )]),
            ..empty_index()
        };

        let source = playlist_source(1, "New Name");
        let folder = resolve_folder(&dir, &mut index, &source, &HashSet::new()).unwrap();

        assert_eq!(folder, dir.join("New Name (2)"));
        assert_eq!(index.playlists["1"].folder_name, "New Name (2)");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn resolve_folder_plugs_into_an_already_existing_folder_of_the_same_name() {
        let dir = tempfile_dir();
        // A folder the user already has, never created by DJ Cloud, that happens to share a
        // playlist's sanitized name — brand-new resolution should reuse it directly rather than
        // avoiding it, leaving whatever's already inside completely untouched.
        fs::create_dir_all(dir.join("My Mix")).unwrap();
        fs::write(dir.join("My Mix").join("personal.mp3"), b"mine").unwrap();

        let mut index = empty_index();
        let source = playlist_source(7, "My Mix");

        let folder = resolve_folder(&dir, &mut index, &source, &HashSet::new()).unwrap();

        assert_eq!(folder, dir.join("My Mix"));
        assert!(dir.join("My Mix").join("personal.mp3").exists());
        assert_eq!(index.playlists["7"].folder_name, "My Mix");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn resolve_folder_still_avoids_a_name_claimed_by_another_active_entry() {
        let dir = tempfile_dir();
        fs::create_dir_all(dir.join("House")).unwrap();

        // Genre "House" already owns the "House" folder name in the index.
        let mut index = SyncIndex {
            genres: HashMap::from([(
                "1".to_string(),
                FolderEntry {
                    folder_name: "House".to_string(),
                },
            )]),
            ..empty_index()
        };

        let source = playlist_source(9, "House");
        let folder = resolve_folder(&dir, &mut index, &source, &HashSet::new()).unwrap();

        assert_eq!(folder, dir.join("House (2)"));
        assert_eq!(index.playlists["9"].folder_name, "House (2)");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn resolve_folder_renames_local_folder_when_genre_is_renamed_remotely() {
        let dir = tempfile_dir();
        fs::create_dir_all(dir.join("Old Name")).unwrap();
        fs::write(dir.join("Old Name").join("track.mp3"), b"data").unwrap();

        let mut index = SyncIndex {
            genres: HashMap::from([(
                "1".to_string(),
                FolderEntry {
                    folder_name: "Old Name".to_string(),
                },
            )]),
            ..empty_index()
        };

        let source = genre_source(1, "New Name");
        let folder = resolve_folder(&dir, &mut index, &source, &HashSet::new()).unwrap();

        assert_eq!(folder, dir.join("New Name"));
        assert!(folder.join("track.mp3").exists());
        assert_eq!(index.genres["1"].folder_name, "New Name");

        fs::remove_dir_all(&dir).ok();
    }

    /// The key case for the flat shared-namespace decision: a playlist and a genre with the same
    /// sanitized name must resolve to two distinct folders, never merge into one.
    #[test]
    fn resolve_folder_keeps_a_playlist_and_a_genre_with_the_same_name_in_distinct_folders() {
        let dir = tempfile_dir();
        let mut index = empty_index();

        let playlist_folder = resolve_folder(
            &dir,
            &mut index,
            &playlist_source(1, "House"),
            &HashSet::new(),
        )
        .unwrap();
        let genre_folder =
            resolve_folder(&dir, &mut index, &genre_source(1, "House"), &HashSet::new()).unwrap();

        assert_eq!(playlist_folder, dir.join("House"));
        assert_eq!(genre_folder, dir.join("House (2)"));
        assert_ne!(playlist_folder, genre_folder);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn encode_path_segment_escapes_slashes_and_spaces() {
        assert_eq!(encode_path_segment("Drum & Bass"), "Drum%20&%20Bass");
        assert_eq!(encode_path_segment("Rock/Metal"), "Rock%2FMetal");
    }
}
