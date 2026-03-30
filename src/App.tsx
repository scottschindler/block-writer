import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSession } from "./useSession";

interface Document {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const DURATION_OPTIONS = [
  { label: "5 min", seconds: 300 },
  { label: "15 min", seconds: 900 },
  { label: "25 min", seconds: 1500 },
  { label: "60 min", seconds: 3600 },
];

function App() {
  const [docId, setDocId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("Ready");

  const [showModal, setShowModal] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [modalError, setModalError] = useState("");
  const [exitIntent, setExitIntent] = useState(false);

  const { session, start, stop, interrupt } = useSession();

  const loadOrCreate = useCallback(async () => {
    const docs = await invoke<Document[]>("list_documents");
    if (docs.length > 0) {
      const doc = docs[0];
      setDocId(doc.id);
      setTitle(doc.title);
      setContent(doc.content);
    } else {
      const id = await invoke<number>("create_document");
      setDocId(id);
      setTitle("");
      setContent("");
    }
  }, []);

  useEffect(() => {
    loadOrCreate();
  }, [loadOrCreate]);

  const save = useCallback(async () => {
    if (docId === null) return;
    setStatus("Saving...");
    await invoke("update_document", { id: docId, title, content });
    setStatus("Saved");
    setTimeout(() => setStatus("Ready"), 1500);
  }, [docId, title, content]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  // Listen for close-requested from Rust (intercepted window close / Cmd+Q)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("show-exit-passphrase-modal", () => {
      setExitIntent(true);
      setShowModal(true);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const handleConfirm = async () => {
    try {
      if (exitIntent) {
        await invoke("unlock_quit", { passphrase });
        setShowModal(false);
        setPassphrase("");
        setModalError("");
        await getCurrentWindow().close();
      } else {
        await interrupt(passphrase);
        setShowModal(false);
        setPassphrase("");
        setModalError("");
      }
    } catch {
      setModalError("Incorrect passphrase. Type END SESSION.");
    }
  };

  const openEndSessionModal = () => {
    setExitIntent(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setPassphrase("");
    setModalError("");
    setExitIntent(false);
  };

  const isActive = session.state === "active";
  const isCompleted = session.state === "completed";

  return (
    <div className="app">
      <div className="toolbar">
        <input
          className="title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
        />
        <button onClick={save}>Save</button>
        <span className="status">{status}</span>
      </div>

      {isActive && (
        <div className="session-bar session-bar--active">
          <span className="session-timer">{formatTime(session.remainingSec)}</span>
          <button className="session-btn session-btn--interrupt" onClick={openEndSessionModal}>
            End Session
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="session-bar session-bar--completed">
          <span>Session complete</span>
          <button className="session-btn session-btn--reset" onClick={stop}>
            Dismiss
          </button>
        </div>
      )}

      {session.state === "idle" && (
        <div className="session-bar">
          <span className="session-label">Start a session:</span>
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.seconds}
              className="session-btn"
              onClick={() => start(opt.seconds)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <textarea
        className="editor"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start writing..."
      />

      <div className="status-bar">
        <span>{content.length} characters</span>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">{exitIntent ? "Quit App" : "End Session"}</h3>
            <p className="modal-desc">
              Type <code>END SESSION</code> to confirm
            </p>
            <input
              className="modal-input"
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.target.value);
                setModalError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              placeholder="END SESSION"
              autoFocus
            />
            {modalError && <p className="modal-error">{modalError}</p>}
            <div className="modal-actions">
              <button className="modal-btn modal-btn--cancel" onClick={closeModal}>
                Cancel
              </button>
              <button className="modal-btn modal-btn--confirm" onClick={handleConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
