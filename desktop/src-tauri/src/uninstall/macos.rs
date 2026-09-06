use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

/// macOS has no installer step to hand off to (Tauri just ships a `.app` bundle inside a `.dmg`),
/// so "uninstalling" means moving the running bundle to the Trash — done through Finder rather
/// than deleting the files directly so it actually lands in the Trash (recoverable) and goes
/// through the same permission prompt a manual drag-to-Trash would.
pub fn launch_uninstaller() -> Result<(), String> {
    let bundle_path = app_bundle_path()?;
    let escaped = bundle_path
        .display()
        .to_string()
        .replace('\\', "\\\\")
        .replace('"', "\\\"");
    let script = format!("tell application \"Finder\" to delete POSIX file \"{escaped}\"");

    Command::new("osascript")
        .args(["-e", &script])
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("Could not ask Finder to delete the app: {err}"))
}

/// The running binary lives at `<bundle>.app/Contents/MacOS/<binary>` — walk up three levels to
/// get back to the bundle root itself.
fn app_bundle_path() -> Result<PathBuf, String> {
    let exe = env::current_exe().map_err(|err| err.to_string())?;
    exe.parent() // Contents/MacOS
        .and_then(Path::parent) // Contents
        .and_then(Path::parent) // <name>.app
        .map(Path::to_path_buf)
        .ok_or_else(|| "Could not locate the .app bundle to remove".to_string())
}
