use std::process::Command;

use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
use winreg::{RegKey, HKEY};

// Matches `productName` in `tauri.conf.json`, which both the NSIS and WiX bundlers use as the
// `DisplayName` of the "Programs and Features" entry they register.
const DISPLAY_NAME: &str = "DJ Cloud Desktop";

/// Windows' own "Programs and Features" reads uninstall entries from these three registry
/// locations (32-bit apps get redirected into WOW6432Node on 64-bit Windows, and NSIS/MSI can
/// each install either per-machine or per-user) — checked in order until this app's entry shows
/// up, since only one of the NSIS/WiX installers this project builds will actually be the one the
/// user ran.
const UNINSTALL_ROOTS: &[(HKEY, &str)] = &[
    (
        HKEY_LOCAL_MACHINE,
        r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
    ),
    (
        HKEY_LOCAL_MACHINE,
        r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ),
    (
        HKEY_CURRENT_USER,
        r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
    ),
];

pub fn launch_uninstaller() -> Result<(), String> {
    for (hive, path) in UNINSTALL_ROOTS {
        let root = RegKey::predef(*hive);
        let Ok(uninstall_key) = root.open_subkey(path) else {
            continue;
        };

        for name in uninstall_key.enum_keys().flatten() {
            let Ok(entry) = uninstall_key.open_subkey(&name) else {
                continue;
            };
            let display_name: String = entry.get_value("DisplayName").unwrap_or_default();
            if display_name != DISPLAY_NAME {
                continue;
            }

            // MSI-managed entries are keyed by their ProductCode (a GUID) and marked with
            // `WindowsInstaller = 1` — the same flag "Programs and Features" itself checks to
            // decide between handing off to `msiexec` and running the vendor's own uninstaller.
            let is_msi: u32 = entry.get_value("WindowsInstaller").unwrap_or(0);
            if is_msi == 1 {
                return Command::new("msiexec")
                    .args(["/x", &name])
                    .spawn()
                    .map(|_| ())
                    .map_err(|err| format!("Could not start msiexec: {err}"));
            }

            let uninstall_string: String = entry
                .get_value("UninstallString")
                .map_err(|err| format!("Uninstall entry has no UninstallString: {err}"))?;
            return spawn_uninstall_string(&uninstall_string);
        }
    }

    Err("Could not find an uninstall entry for this app in the registry".to_string())
}

/// The NSIS bundler this project uses registers `UninstallString` as a plain quoted path to
/// `uninstall.exe` with no extra arguments, so a straight strip-and-spawn covers it without
/// needing to hand the string to a shell for re-parsing.
fn spawn_uninstall_string(uninstall_string: &str) -> Result<(), String> {
    let path = uninstall_string
        .trim()
        .trim_start_matches('"')
        .trim_end_matches('"');

    Command::new(path)
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("Could not start uninstaller at {path}: {err}"))
}
