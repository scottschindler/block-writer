use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::enforcement::EnforcementState;
use crate::session::SessionSnapshot;
use crate::AppState;

// ── License types & commands ──────────────────────────────────────────

const FREE_SESSIONS: i64 = 3;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    pub activated: bool,
    pub sessions_completed: i64,
    pub free_sessions: i64,
    pub can_start_session: bool,
}

#[tauri::command]
pub fn get_license_status(state: State<AppState>) -> Result<LicenseStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let (activated, sessions_completed): (bool, i64) = conn
        .query_row(
            "SELECT activated, sessions_completed FROM license WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    Ok(LicenseStatus {
        activated,
        sessions_completed,
        free_sessions: FREE_SESSIONS,
        can_start_session: activated || sessions_completed < FREE_SESSIONS,
    })
}

#[derive(Deserialize)]
struct VerifyResponse {
    valid: bool,
}

#[tauri::command]
pub fn activate_license(state: State<AppState>, code: String) -> Result<LicenseStatus, String> {
    let verify_url = "https://block-writer.vercel.app/api/verify";
    let resp = reqwest::blocking::get(format!("{}?session_id={}", verify_url, code))
        .map_err(|e| format!("Network error: {}", e))?
        .json::<VerifyResponse>()
        .map_err(|e| format!("Invalid response: {}", e))?;

    if !resp.valid {
        return Err("Invalid or unpaid activation code".into());
    }

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE license SET activated = 1, activation_code = ?1 WHERE id = 1",
        [&code],
    )
    .map_err(|e| e.to_string())?;

    drop(conn);
    get_license_status(state)
}

#[tauri::command]
pub fn record_session_completed(state: State<AppState>) -> Result<LicenseStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE license SET sessions_completed = sessions_completed + 1 WHERE id = 1",
        [],
    )
    .map_err(|e| e.to_string())?;

    drop(conn);
    get_license_status(state)
}

// ── Document types & commands ──────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Document {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn list_documents(state: State<AppState>) -> Result<Vec<Document>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, content, created_at, updated_at \
             FROM documents ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let docs = stmt
        .query_map([], |row| {
            Ok(Document {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(docs)
}

#[tauri::command]
pub fn create_document(state: State<AppState>) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO documents (title, content) VALUES ('', '')", [])
        .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_document(
    state: State<AppState>,
    id: i64,
    title: String,
    content: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE documents SET title = ?1, content = ?2, updated_at = CURRENT_TIMESTAMP \
         WHERE id = ?3",
        (&title, &content, &id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_document(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM documents WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Session commands ───────────────────────────────────────────────────

#[tauri::command]
pub fn start_session(app_handle: AppHandle, duration_sec: u64, state: State<AppState>) -> Result<SessionSnapshot, String> {
    if duration_sec == 0 {
        return Err("duration_sec must be > 0".into());
    }

    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    if session.state == "active" {
        return Err("session already active".into());
    }

    session.start(duration_sec);

    // Capture baseline PIDs for enforcement
    let enf = EnforcementState::new();
    if let Ok(mut guard) = state.enforcement.lock() {
        *guard = Some(enf);
    }

    #[cfg(target_os = "macos")]
    let _ = app_handle.set_dock_visibility(false);

    Ok(session.snapshot())
}

#[tauri::command]
pub fn get_session(state: State<AppState>) -> Result<SessionSnapshot, String> {
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    session.maybe_complete();
    Ok(session.snapshot())
}

#[tauri::command]
pub fn stop_session(app_handle: AppHandle, state: State<AppState>) -> Result<SessionSnapshot, String> {
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    session.stop();

    if let Ok(mut guard) = state.enforcement.lock() {
        *guard = None;
    }

    #[cfg(target_os = "macos")]
    let _ = app_handle.set_dock_visibility(true);

    Ok(session.snapshot())
}

#[tauri::command]
pub fn interrupt_session(
    app_handle: AppHandle,
    state: State<AppState>,
    passphrase: String,
) -> Result<SessionSnapshot, String> {
    if passphrase != "END SESSION" {
        return Err("incorrect passphrase".into());
    }

    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    session.interrupt();

    if let Ok(mut guard) = state.enforcement.lock() {
        *guard = None;
    }

    #[cfg(target_os = "macos")]
    let _ = app_handle.set_dock_visibility(true);

    Ok(session.snapshot())
}

#[tauri::command]
pub fn unlock_quit(app_handle: AppHandle, passphrase: String, state: State<AppState>) -> Result<(), String> {
    let mut session = state.session.lock().map_err(|e| e.to_string())?;

    if session.state != "active" {
        let mut allow_quit = state.allow_quit.lock().map_err(|e| e.to_string())?;
        *allow_quit = true;
        return Ok(());
    }

    if passphrase != "END SESSION" {
        return Err("incorrect passphrase".into());
    }

    session.interrupt();

    if let Ok(mut guard) = state.enforcement.lock() {
        *guard = None;
    }

    #[cfg(target_os = "macos")]
    let _ = app_handle.set_dock_visibility(true);

    let mut allow_quit = state.allow_quit.lock().map_err(|e| e.to_string())?;
    *allow_quit = true;

    Ok(())
}
