use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_store::StoreExt;

use crate::settings::STORE_PATH;

const AUTOSTART_DECIDED_KEY: &str = "autostartDecided";

/// Enables autostart the first time the app runs after install. Only ever acts once — if a user
/// later disables it via the OS's own startup-apps UI, this must not silently re-enable it on the
/// next launch, so the decision is recorded in the same settings store `settings.rs` already uses.
pub fn ensure_enabled_on_first_run(app: &AppHandle) {
    let Ok(store) = app.store(STORE_PATH) else {
        return;
    };

    if store
        .get(AUTOSTART_DECIDED_KEY)
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
    {
        return;
    }

    let _ = app.autolaunch().enable();
    store.set(AUTOSTART_DECIDED_KEY, true);
    let _ = store.save();
}

/// Removes the autostart registration on uninstall, best-effort, so no dangling Run key /
/// LaunchAgent plist is left pointing at a deleted executable.
pub fn disable_for_uninstall(app: &AppHandle) {
    let _ = app.autolaunch().disable();
}
