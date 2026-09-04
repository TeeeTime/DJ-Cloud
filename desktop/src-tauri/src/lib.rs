use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition, Rect, WindowEvent,
};

/// Last known position/size of the tray icon, updated on every tray event so a window can be
/// positioned relative to it even when shown from the right-click menu rather than a fresh click.
struct TrayRect(Mutex<Option<Rect>>);

/// Whether the pointer is currently over the tray icon, updated on `Enter`/`Move`/`Leave`. A
/// click of either button necessarily happens while this is true, and it flips true well before
/// the click is processed — unlike trying to correlate a click event with the focus-loss it
/// causes after the fact, since a right-click's own notification can be delayed arbitrarily long
/// behind the OS's blocking native context-menu call. Used to stop that focus loss from hiding
/// the window: right-clicking should only ever open the menu, never close the window.
struct PointerOverTray(Mutex<bool>);

/// The context menu's Show/Hide item, kept around so its label can track window visibility.
struct ShowHideMenuItem(MenuItem<tauri::Wry>);

fn set_show_hide_label(manager: &impl Manager<tauri::Wry>, label: &str) {
    if let Some(state) = manager.try_state::<ShowHideMenuItem>() {
        let _ = state.0.set_text(label);
    }
}

fn position_window_near_tray(app: &tauri::AppHandle, tray_rect: &Rect) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let tray_position = tray_rect.position.to_physical::<f64>(scale_factor);
    let tray_size = tray_rect.size.to_physical::<f64>(scale_factor);
    let Ok(window_size) = window.outer_size() else {
        return;
    };

    let x = tray_position.x + tray_size.width / 2.0 - window_size.width as f64 / 2.0;
    // macOS' menu bar sits at the top of the screen, so the popup opens below the icon there;
    // Windows' (and most Linux) tray sits at the bottom, so it opens above the icon.
    #[cfg(target_os = "macos")]
    let y = tray_position.y + tray_size.height;
    #[cfg(not(target_os = "macos"))]
    let y = tray_position.y - window_size.height as f64;

    let _ = window.set_position(PhysicalPosition::new(x, y));
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<TrayRect>() {
        if let Some(rect) = *state.0.lock().unwrap() {
            position_window_near_tray(app, &rect);
        }
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    set_show_hide_label(app, "Hide");
}

fn hide_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    set_show_hide_label(app, "Show");
}

/// Left-click on the tray icon, or the context menu's Show/Hide item: hide the window if it's
/// open, otherwise show it.
fn toggle_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if window.is_visible().unwrap_or(false) {
        hide_main_window(app);
    } else {
        show_main_window(app);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(TrayRect(Mutex::new(None)))
        .manage(PointerOverTray(Mutex::new(false)))
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
            app.manage(ShowHideMenuItem(show_item));

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => toggle_main_window(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    let app = tray.app_handle();

                    let rect = match &event {
                        TrayIconEvent::Click { rect, .. }
                        | TrayIconEvent::DoubleClick { rect, .. }
                        | TrayIconEvent::Enter { rect, .. }
                        | TrayIconEvent::Move { rect, .. }
                        | TrayIconEvent::Leave { rect, .. } => Some(*rect),
                        _ => None,
                    };
                    if let Some(rect) = rect {
                        if let Some(state) = app.try_state::<TrayRect>() {
                            *state.0.lock().unwrap() = Some(rect);
                        }
                    }

                    if let Some(state) = app.try_state::<PointerOverTray>() {
                        match &event {
                            TrayIconEvent::Enter { .. } | TrayIconEvent::Move { .. } => {
                                *state.0.lock().unwrap() = true;
                            }
                            TrayIconEvent::Leave { .. } => {
                                *state.0.lock().unwrap() = false;
                            }
                            _ => {}
                        }
                    }

                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(app);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
                set_show_hide_label(window, "Show");
            }
            WindowEvent::Focused(false) => {
                let pointer_over_tray = window
                    .try_state::<PointerOverTray>()
                    .map(|state| *state.0.lock().unwrap())
                    .unwrap_or(false);

                // Losing focus while the pointer is over the tray icon means this blur is a
                // side effect of clicking the icon itself (most likely to open the context
                // menu) — leave the window alone and let the tray/menu handlers decide.
                if !pointer_over_tray && window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                    set_show_hide_label(window, "Show");
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
