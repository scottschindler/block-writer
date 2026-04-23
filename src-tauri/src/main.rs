mod commands;
mod enforcement;
mod session;

use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use directories::ProjectDirs;
use enforcement::EnforcementState;
use rusqlite::Connection;
use session::SessionState;
use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager, RunEvent, WindowEvent};

pub struct AppState {
    pub db: Mutex<Connection>,
    pub session: Mutex<SessionState>,
    pub enforcement: Mutex<Option<EnforcementState>>,
    pub allow_quit: Mutex<bool>,
}

impl AppState {
    fn should_allow_quit(&self) -> bool {
        let allow_quit = self.allow_quit.lock().map(|g| *g).unwrap_or(false);
        let session_active = self.session.lock().map(|s| s.state == "active").unwrap_or(false);
        allow_quit || !session_active
    }
}

fn main() {
    #[cfg(target_os = "macos")]
    {
        use objc2_foundation::{NSProcessInfo, NSString};
        let info = NSProcessInfo::processInfo();
        let name = NSString::from_str("Block Writer");
        info.setProcessName(&name);
    }

    let db_path = ProjectDirs::from("com", "block-writer", "Block Writer")
        .map(|dirs| dirs.data_dir().join("documents.db"))
        .unwrap_or_else(|| std::path::PathBuf::from("documents.db"));

    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).expect("Failed to create data directory");
    }

    let conn = Connection::open(&db_path).expect("Failed to open database");
    conn.execute(
        "CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )
    .expect("Failed to create documents table");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS license (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            activated INTEGER NOT NULL DEFAULT 0,
            sessions_completed INTEGER NOT NULL DEFAULT 0,
            activation_code TEXT
        )",
        [],
    )
    .expect("Failed to create license table");

    conn.execute(
        "INSERT OR IGNORE INTO license (id, activated, sessions_completed) VALUES (1, 0, 0)",
        [],
    )
    .expect("Failed to seed license row");

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            db: Mutex::new(conn),
            session: Mutex::new(SessionState::new()),
            enforcement: Mutex::new(None),
            allow_quit: Mutex::new(false),
        })
        .setup(|app| {
            let handle = app.handle();

            let app_menu = SubmenuBuilder::new(handle, "Block Writer")
                .item(&PredefinedMenuItem::about(
                    handle,
                    Some("Block Writer"),
                    None,
                )?)
                .separator()
                .item(&PredefinedMenuItem::hide(handle, None)?)
                .item(&PredefinedMenuItem::hide_others(handle, None)?)
                .item(&PredefinedMenuItem::show_all(handle, None)?)
                .separator()
                .item(&PredefinedMenuItem::close_window(handle, None)?)
                .item(&MenuItem::with_id(handle, "custom-quit", "Quit Block Writer", true, Some("CmdOrCtrl+Q"))?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(handle, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(handle)
                .item(&app_menu)
                .item(&edit_menu)
                .build()?;

            app.set_menu(menu)?;

            let app_handle = app.handle().clone();

            thread::spawn(move || {
                let self_pid = std::process::id();

                loop {
                    thread::sleep(Duration::from_millis(400));

                    let (should_emit, is_active) = {
                        let state = app_handle.state::<AppState>();
                        let mut session = match state.session.lock() {
                            Ok(s) => s,
                            Err(_) => continue,
                        };
                        let completed = session.maybe_complete();
                        let active = session.state == "active";
                        (completed, active)
                    };

                    if should_emit {
                        let _ = app_handle.emit("session-completed", ());

                        if let Ok(mut enf) = app_handle.state::<AppState>().enforcement.lock() {
                            *enf = None;
                        }

                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.set_always_on_top(false);
                            let _ = win.set_fullscreen(false);
                        }
                    }

                    if is_active {
                        let state = app_handle.state::<AppState>();
                        if let Ok(enf_guard) = state.enforcement.lock() {
                            if let Some(ref enf) = *enf_guard {
                                enf.enforce(self_pid);
                            }
                        }

                        if let Some(win) = app_handle.get_webview_window("main") {
                            // Re-enter fullscreen if the user escaped it; don't
                            // touch always-on-top while fullscreen is in flight
                            // — setting window level mid-transition kicks macOS
                            // out of native fullscreen.
                            let in_fullscreen = win.is_fullscreen().unwrap_or(false);
                            if !in_fullscreen {
                                let _ = win.set_fullscreen(true);
                            }
                            let _ = win.set_focus();
                        }
                    }
                }
            });

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "custom-quit" {
                let state = app.state::<AppState>();
                if state.should_allow_quit() {
                    app.exit(0);
                } else {
                    let _ = app.emit("show-exit-passphrase-modal", ());
                }
            }
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                if state.should_allow_quit() {
                    return;
                }

                api.prevent_close();
                let _ = window.emit("show-exit-passphrase-modal", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_documents,
            commands::create_document,
            commands::update_document,
            commands::delete_document,
            commands::start_session,
            commands::get_session,
            commands::stop_session,
            commands::interrupt_session,
            commands::unlock_quit,
            commands::get_license_status,
            commands::activate_license,
            commands::record_session_completed,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        // Backup: app-level quit interception (covers paths that don't go through window close)
        if let RunEvent::ExitRequested { api, .. } = event {
            let state = app_handle.state::<AppState>();
            if !state.should_allow_quit() {
                api.prevent_exit();
                let _ = app_handle.emit("show-exit-passphrase-modal", ());
            }
        }
    });
}
