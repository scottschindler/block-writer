use tauri::{AppHandle, Manager};

pub fn enter(app_handle: &AppHandle) {
    // This transform removes Block Writer from the macOS Force Quit list
    // during a locked session. Native fullscreen does not coexist with it, so
    // the session window uses simple fullscreen below.
    #[cfg(target_os = "macos")]
    let _ = app_handle.set_dock_visibility(false);

    maintain(app_handle);
}

pub fn maintain(app_handle: &AppHandle) {
    if let Some(win) = app_handle.get_webview_window("main") {
        let _ = win.set_simple_fullscreen(true);
        let _ = win.set_always_on_top(true);
        let _ = win.set_focus();
    }
}

pub fn leave(app_handle: &AppHandle) {
    if let Some(win) = app_handle.get_webview_window("main") {
        let _ = win.set_always_on_top(false);
        let _ = win.set_simple_fullscreen(false);
        let _ = win.set_fullscreen(false);
    }

    #[cfg(target_os = "macos")]
    let _ = app_handle.set_dock_visibility(true);
}
