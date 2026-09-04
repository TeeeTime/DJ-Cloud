use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_store::StoreExt;
use url::Url;

use crate::http;
use crate::settings::STORE_PATH;

const AUTH_KEY: &str = "auth";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthInfo {
    pub token: String,
    pub username: String,
}

#[tauri::command]
pub fn get_auth_token(app: AppHandle) -> Result<Option<AuthInfo>, String> {
    get_auth_token_internal(&app)
}

pub fn get_auth_token_internal(app: &AppHandle) -> Result<Option<AuthInfo>, String> {
    let store = app.store(STORE_PATH).map_err(|err| err.to_string())?;
    Ok(store
        .get(AUTH_KEY)
        .and_then(|value| serde_json::from_value::<AuthInfo>(value).ok()))
}

#[tauri::command]
pub fn clear_auth_token(app: AppHandle) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|err| err.to_string())?;
    store.delete(AUTH_KEY);
    store.save().map_err(|err| err.to_string())
}

/// Confirms the stored token still works by calling `GET /api/auth/me` — false for "not logged
/// in" (no stored token) as well as an actually-invalid/expired one; either way the caller falls
/// back to the login screen.
#[tauri::command]
pub async fn validate_auth_token(app: AppHandle) -> Result<bool, String> {
    let Some(auth) = get_auth_token_internal(&app)? else {
        return Ok(false);
    };

    let client = Client::new();
    Ok(http::get(&client, &auth.token, "/api/auth/me")
        .await
        .is_ok())
}

fn store_auth(app: &AppHandle, info: &AuthInfo) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|err| err.to_string())?;
    store.set(
        AUTH_KEY,
        serde_json::to_value(info).map_err(|err| err.to_string())?,
    );
    store.save().map_err(|err| err.to_string())
}

/// Parses `djcloud://auth?token=...&username=...` (sent by `frontend/app/login/page.tsx` after a
/// desktop-flagged login), persists it, and notifies the frontend so `App.tsx` can move off the
/// login screen. Runs entirely in Rust — independent of whether the JS side has mounted yet.
fn handle_deep_link_url(app: &AppHandle, url: &Url) {
    if url.host_str() != Some("auth") {
        return;
    }

    let params: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
    let (Some(token), Some(username)) = (params.get("token"), params.get("username")) else {
        return;
    };

    let info = AuthInfo {
        token: token.clone(),
        username: username.clone(),
    };

    if store_auth(app, &info).is_ok() {
        let _ = app.emit("auth-token-received", &info);
    }
}

/// Registers the deep-link listener. Also re-registers the `djcloud` scheme with Windows on every
/// debug-build startup, pointed at the current dev binary — release builds rely on the installer
/// for this instead (see `tauri.conf.json`'s NSIS/WiX config), so it's skipped there.
pub fn setup(app: &AppHandle) {
    #[cfg(debug_assertions)]
    {
        if let Err(err) = app.deep_link().register("djcloud") {
            eprintln!("Could not register djcloud:// scheme for this dev build: {err}");
        }
    }

    let app_handle = app.clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            handle_deep_link_url(&app_handle, &url);
        }
    });
}
