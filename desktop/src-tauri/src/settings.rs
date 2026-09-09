use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::relocate;

pub const STORE_PATH: &str = "settings.json";
const LIBRARY_FOLDER_KEY: &str = "libraryFolder";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub library_folder: Option<String>,
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    let store = app.store(STORE_PATH).map_err(|err| err.to_string())?;
    let library_folder = store
        .get(LIBRARY_FOLDER_KEY)
        .and_then(|value| value.as_str().map(str::to_string));

    Ok(AppSettings { library_folder })
}

/// Changing the folder relocates any existing library contents to the new path first — so
/// switching folders never leaves the old one behind full of already-downloaded files, and
/// never requires a re-sync to repopulate the new location (see `relocate::relocate`).
#[tauri::command]
pub fn set_library_folder(app: AppHandle, folder: String) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|err| err.to_string())?;
    let previous = store
        .get(LIBRARY_FOLDER_KEY)
        .and_then(|value| value.as_str().map(str::to_string));

    if let Some(previous) = &previous {
        relocate::relocate(Path::new(previous), Path::new(&folder))?;
    }

    store.set(LIBRARY_FOLDER_KEY, folder);
    store.save().map_err(|err| err.to_string())
}
