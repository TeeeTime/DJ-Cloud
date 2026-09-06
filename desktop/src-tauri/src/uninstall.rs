use tauri::AppHandle;

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "windows")]
use windows::launch_uninstaller;

#[cfg(target_os = "macos")]
use macos::launch_uninstaller;

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn launch_uninstaller() -> Result<(), String> {
    Err("Uninstalling isn't supported on this platform yet".to_string())
}

/// Launches this platform's native uninstall process and then quits — the uninstaller (or, on
/// macOS, Finder moving the bundle to the Trash) needs this app's own files to no longer be in
/// use to remove them.
#[tauri::command]
pub fn uninstall_app(app: AppHandle) -> Result<(), String> {
    launch_uninstaller()?;
    app.exit(0);
    Ok(())
}
