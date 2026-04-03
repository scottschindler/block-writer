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
use tauri::menu::{MenuBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager, RunEvent, WindowEvent};

pub struct AppState {
    pub db: Mutex<Connection>,
    pub session: Mutex<SessionState>,
    pub enforcement: Mutex<Option<EnforcementState>>,
    pub allow_quit: Mutex<bool>,
}

fn main() {
    let db_path = ProjectDirs::from("com", "focused-writer", "Focused Writer")
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
    .expect("Failed to create table");

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .menu(|app| {
            let app_menu = SubmenuBuilder::new(app, "Focused Writer")
                .item(&PredefinedMenuItem::about(
                    app,
                    Some("Focused Writer"),
                    None,
                )?)
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .build()
        })
        .manage(AppState {
            db: Mutex::new(conn),
            session: Mutex::new(SessionState::new()),
            enforcement: Mutex::new(None),
            allow_quit: Mutex::new(false),
        })
        .setup(|app| {
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
                            let _ = win.set_always_on_top(true);
                            let _ = win.set_focus();
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                let allow_quit = state.allow_quit.lock().map(|g| *g).unwrap_or(false);

                if allow_quit {
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
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        // Backup: app-level quit interception (covers paths that don't go through window close)
        if let RunEvent::ExitRequested { api, .. } = event {
            let state = app_handle.state::<AppState>();
            let allow_quit = state.allow_quit.lock().map(|g| *g).unwrap_or(false);

            if !allow_quit {
                api.prevent_exit();
                let _ = app_handle.emit("show-exit-passphrase-modal", ());
            }
        }
    });
}
