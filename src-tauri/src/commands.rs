use serde::{Deserialize, Serialize};
use tauri::State;

use crate::enforcement::EnforcementState;
use crate::session::SessionSnapshot;
use crate::AppState;

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
pub fn start_session(duration_sec: u64, state: State<AppState>) -> Result<SessionSnapshot, String> {
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

    Ok(session.snapshot())
}

#[tauri::command]
pub fn get_session(state: State<AppState>) -> Result<SessionSnapshot, String> {
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    session.maybe_complete();
    Ok(session.snapshot())
}

#[tauri::command]
pub fn stop_session(state: State<AppState>) -> Result<SessionSnapshot, String> {
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    session.stop();

    if let Ok(mut guard) = state.enforcement.lock() {
        *guard = None;
    }

    Ok(session.snapshot())
}

#[tauri::command]
pub fn interrupt_session(
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

    Ok(session.snapshot())
}

#[tauri::command]
pub fn unlock_quit(passphrase: String, state: State<AppState>) -> Result<(), String> {
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

    let mut allow_quit = state.allow_quit.lock().map_err(|e| e.to_string())?;
    *allow_quit = true;

    Ok(())
}
