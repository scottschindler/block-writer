import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-shell";
import { useSession } from "./useSession";
import { getLicenseStatus, activateLicense, recordSessionCompleted, type LicenseStatus } from "./license";
import { checkForUpdate, installUpdate, type UpdateResult } from "./updater";
import type { Update } from "@tauri-apps/plugin-updater";

const appWindow = getCurrentWindow();

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

function execFormat(command: string, value?: string) {
  document.execCommand(command, false, value);
}

function queryFormat(command: string): boolean {
  return document.queryCommandState(command);
}

function getBlockType(): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "p";
  let node: Node | null = sel.anchorNode;
  while (node && node !== document) {
    if (node.nodeType === 1) {
      const tag = (node as Element).tagName.toLowerCase();
      if (["h1", "h2", "h3", "blockquote"].includes(tag)) return tag;
    }
    node = node.parentNode;
  }
  return "p";
}

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  title?: string;
}

function ToolbarButton({ label, active, onClick, title }: ToolbarButtonProps) {
  return (
    <button
      className={`fmt-btn${active ? " fmt-btn--active" : ""}`}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
    >
      {label}
    </button>
  );
}

function ToolbarSep() {
  return <div className="fmt-sep" />;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "Z");
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function App() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [docId, setDocId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const contentHtml = useRef("");
  const dirty = useRef(false);

  const [showModal, setShowModal] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [modalError, setModalError] = useState("");
  const [exitIntent, setExitIntent] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [activationCode, setActivationCode] = useState("");
  const [activationError, setActivationError] = useState("");
  const [activating, setActivating] = useState(false);

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    insertUnorderedList: false,
    insertOrderedList: false,
    blockType: "p",
  });

  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const [updating, setUpdating] = useState(false);

  const { session, start, stop, interrupt } = useSession();

  const updateToolbarState = useCallback(() => {
    setActiveFormats({
      bold: queryFormat("bold"),
      italic: queryFormat("italic"),
      underline: queryFormat("underline"),
      strikeThrough: queryFormat("strikeThrough"),
      insertUnorderedList: queryFormat("insertUnorderedList"),
      insertOrderedList: queryFormat("insertOrderedList"),
      blockType: getBlockType(),
    });
  }, []);

  const getPlainText = useCallback(() => {
    return contentRef.current?.innerText || "";
  }, []);

  const getWordCount = useCallback(() => {
    const text = getPlainText().trim();
    return text ? text.split(/\s+/).length : 0;
  }, [getPlainText]);

  const getCharCount = useCallback(() => {
    return getPlainText().length;
  }, [getPlainText]);

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const updateCounts = useCallback(() => {
    setWordCount(getWordCount());
    setCharCount(getCharCount());
  }, [getWordCount, getCharCount]);

  const loadDocs = useCallback(async () => {
    const documents = await invoke<Document[]>("list_documents");
    setDocs(documents);
    return documents;
  }, []);

  const loadDocument = useCallback((doc: Document) => {
    setDocId(doc.id);
    contentHtml.current = doc.content;
    if (contentRef.current) {
      contentRef.current.innerHTML = doc.content;
      // Derive title from first line of content
      const text = contentRef.current.innerText || "";
      const firstLine = text.split("\n").find((l) => l.trim() !== "") || "";
      setTitle(firstLine.trim().substring(0, 100));
    } else {
      setTitle(doc.title);
    }
  }, []);

  const loadOrCreate = useCallback(async () => {
    const documents = await loadDocs();
    if (documents.length > 0) {
      loadDocument(documents[0]);
    } else {
      const id = await invoke<number>("create_document");
      setDocId(id);
      setTitle("");
      contentHtml.current = "";
      if (contentRef.current) {
        contentRef.current.innerHTML = "";
      }
      await loadDocs();
    }
    updateCounts();
  }, [loadDocs, loadDocument, updateCounts]);

  useEffect(() => {
    loadOrCreate();
    getLicenseStatus().then(setLicense);
  }, [loadOrCreate]);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    checkForUpdate()
      .then((result) => {
        if (result.available && result.version && result.update) {
          setUpdateVersion(result.version);
          setPendingUpdate(result.update);
        }
      })
      .catch(() => {});
  }, []);

  // Track session completions for trial counting
  const prevSessionState = useRef(session.state);
  useEffect(() => {
    const prev = prevSessionState.current;
    prevSessionState.current = session.state;

    // Count a session when it transitions from active to completed or idle (interrupted)
    if (prev === "active" && (session.state === "completed" || session.state === "idle")) {
      recordSessionCompleted().then(setLicense);
    }
  }, [session.state]);

  const save = useCallback(async () => {
    if (docId === null) return;
    setStatus("Saving...");
    await invoke("update_document", { id: docId, title, content: contentHtml.current });
    dirty.current = false;
    setStatus("Saved");
    await loadDocs();
    setTimeout(() => setStatus(""), 1500);
  }, [docId, title, loadDocs]);

  const createNew = useCallback(async () => {
    // Only save current if it was edited
    if (docId !== null && dirty.current) {
      await invoke("update_document", { id: docId, title, content: contentHtml.current });
      dirty.current = false;
    }
    const id = await invoke<number>("create_document");
    setDocId(id);
    setTitle("");
    contentHtml.current = "";
    if (contentRef.current) {
      contentRef.current.innerHTML = "";
    }
    updateCounts();
    await loadDocs();
  }, [docId, title, loadDocs, updateCounts]);

  const switchDoc = useCallback(async (doc: Document) => {
    // Only save current if it was edited
    if (docId !== null && dirty.current) {
      await invoke("update_document", { id: docId, title, content: contentHtml.current });
      dirty.current = false;
      await loadDocs();
    }
    loadDocument(doc);
    updateCounts();
  }, [docId, title, loadDocument, loadDocs, updateCounts]);

  const confirmDelete = useCallback(async () => {
    if (deleteTarget === null) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    await invoke("delete_document", { id });
    const documents = await loadDocs();
    if (id === docId) {
      if (documents.length > 0) {
        loadDocument(documents[0]);
      } else {
        const newId = await invoke<number>("create_document");
        setDocId(newId);
        setTitle("");
        contentHtml.current = "";
        if (contentRef.current) {
          contentRef.current.innerHTML = "";
        }
        await loadDocs();
      }
      updateCounts();
    }
  }, [deleteTarget, docId, loadDocs, loadDocument, updateCounts]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      switch (e.key.toLowerCase()) {
        case "s":
          e.preventDefault();
          save();
          break;
        case "b":
          e.preventDefault();
          execFormat("bold");
          updateToolbarState();
          break;
        case "i":
          e.preventDefault();
          execFormat("italic");
          updateToolbarState();
          break;
        case "u":
          e.preventDefault();
          execFormat("underline");
          updateToolbarState();
          break;
        case "n":
          if (e.shiftKey) {
            e.preventDefault();
            createNew();
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save, updateToolbarState, createNew]);

  useEffect(() => {
    document.addEventListener("selectionchange", updateToolbarState);
    return () => document.removeEventListener("selectionchange", updateToolbarState);
  }, [updateToolbarState]);

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

  const handleInput = () => {
    if (contentRef.current) {
      contentHtml.current = contentRef.current.innerHTML;
      dirty.current = true;
      updateCounts();
      // Derive title from first line of text
      const text = contentRef.current.innerText || "";
      const firstLine = text.split("\n").find((l) => l.trim() !== "") || "";
      const newTitle = firstLine.trim().substring(0, 100);
      setTitle(newTitle);
      // Move current doc to top of sidebar immediately
      if (docId !== null) {
        setDocs((prev) => {
          const idx = prev.findIndex((d) => d.id === docId);
          if (idx <= 0) return prev;
          const updated = [...prev];
          const [doc] = updated.splice(idx, 1);
          updated.unshift({ ...doc, title: newTitle || doc.title });
          return updated;
        });
      }
    }
  };

  const toggleBlock = (tag: string) => {
    const current = getBlockType();
    if (current === tag) {
      execFormat("formatBlock", "p");
    } else {
      execFormat("formatBlock", tag);
    }
    updateToolbarState();
  };

  const handleActivate = async () => {
    if (!activationCode.trim()) return;
    setActivating(true);
    setActivationError("");
    try {
      const status = await activateLicense(activationCode.trim());
      setLicense(status);
      setActivationCode("");
    } catch (e: any) {
      setActivationError(e?.toString() || "Activation failed");
    } finally {
      setActivating(false);
    }
  };

  const isActive = session.state === "active";
  const isCompleted = session.state === "completed";
  const showPaywall = license !== null && !license.canStartSession;
  const sessionsRemaining = license ? license.freeSessions - license.sessionsCompleted : null;

  return (
    <div className="app">
      {/* Drag region for window movement */}
      <div className="drag-bar" onMouseDown={() => appWindow.startDragging()} />

      <div className="layout">
        {/* Sidebar */}
        <div className={`sidebar${sidebarOpen ? "" : " sidebar--collapsed"}`}>
          <div className="sidebar-header">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? "\u2039" : "\u203A"}
            </button>
            {sidebarOpen && (
              <button className="sidebar-new" onClick={createNew} title="New document (⌘⇧N)">
                +
              </button>
            )}
          </div>
          {sidebarOpen && (
            <div className="sidebar-list">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className={`sidebar-item${doc.id === docId ? " sidebar-item--active" : ""}`}
                  onClick={() => switchDoc(doc)}
                >
                  <span className="sidebar-item-title">
                    {doc.title || "Untitled"}
                  </span>
                  <span className="sidebar-item-date">
                    {formatDate(doc.updated_at)}
                  </span>
                  {docs.length > 1 && (
                    <button
                      className="sidebar-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(doc.id);
                      }}
                      title="Delete"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="main">

          {updateVersion && !isActive && (
            <div className="update-banner">
              <span>Version {updateVersion} is available.</span>
              <button
                className="update-btn update-btn--install"
                onClick={async () => {
                  if (!pendingUpdate) return;
                  setUpdating(true);
                  try {
                    await installUpdate(pendingUpdate);
                  } catch {
                    setUpdating(false);
                  }
                }}
                disabled={updating}
              >
                {updating ? "Updating..." : "Update now"}
              </button>
              <button
                className="update-btn update-btn--dismiss"
                onClick={() => setUpdateVersion(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="fmt-bar">
            <ToolbarButton
              label="H1"
              active={activeFormats.blockType === "h1"}
              onClick={() => toggleBlock("h1")}
              title="Heading 1"
            />
            <ToolbarButton
              label="H2"
              active={activeFormats.blockType === "h2"}
              onClick={() => toggleBlock("h2")}
              title="Heading 2"
            />
            <ToolbarSep />
            <ToolbarButton
              label="B"
              active={activeFormats.bold}
              onClick={() => execFormat("bold")}
              title="Bold (⌘B)"
            />
            <ToolbarButton
              label="I"
              active={activeFormats.italic}
              onClick={() => execFormat("italic")}
              title="Italic (⌘I)"
            />
            <ToolbarButton
              label="U"
              active={activeFormats.underline}
              onClick={() => execFormat("underline")}
              title="Underline (⌘U)"
            />
            <ToolbarButton
              label="S"
              active={activeFormats.strikeThrough}
              onClick={() => execFormat("strikeThrough")}
              title="Strikethrough"
            />
            <ToolbarSep />
            <ToolbarButton
              label="•"
              active={activeFormats.insertUnorderedList}
              onClick={() => execFormat("insertUnorderedList")}
              title="Bullet list"
            />
            <ToolbarButton
              label="1."
              active={activeFormats.insertOrderedList}
              onClick={() => execFormat("insertOrderedList")}
              title="Numbered list"
            />
            {status && <span className="status">{status}</span>}
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

          {session.state === "idle" && !showPaywall && (
            <div className="session-bar">
              <span className="session-label">Session:</span>
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.seconds}
                  className="session-btn"
                  onClick={() => start(opt.seconds)}
                >
                  {opt.label}
                </button>
              ))}
              {sessionsRemaining !== null && !license?.activated && sessionsRemaining > 0 && (
                <span className="session-label" style={{ marginLeft: "auto" }}>
                  {sessionsRemaining} free session{sessionsRemaining !== 1 ? "s" : ""} remaining
                </span>
              )}
            </div>
          )}

          {session.state === "idle" && showPaywall && (
            <div className="paywall">
              <div className="paywall-content">
                <h2 className="paywall-title">Free trial complete</h2>
                <p className="paywall-desc">
                  You've used your 3 free sessions. Get lifetime access to Focused Writer for a one-time payment of $15.
                </p>
                <button
                  className="paywall-buy"
                  onClick={() => open("https://buy.stripe.com/eVq9AV8aT3fBaro0F06J200")}
                >
                  Buy for $15 — Lifetime Access
                </button>
                <div className="paywall-activate">
                  <p className="paywall-activate-label">Already purchased? Enter your activation code:</p>
                  <div className="paywall-activate-row">
                    <input
                      className="paywall-input"
                      value={activationCode}
                      onChange={(e) => {
                        setActivationCode(e.target.value);
                        setActivationError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                      placeholder="Paste your activation code"
                    />
                    <button
                      className="paywall-activate-btn"
                      onClick={handleActivate}
                      disabled={activating}
                    >
                      {activating ? "Verifying..." : "Activate"}
                    </button>
                  </div>
                  {activationError && <p className="paywall-error">{activationError}</p>}
                </div>
              </div>
            </div>
          )}

          {!showPaywall && (
            <div
              ref={contentRef}
              className="editor"
              contentEditable
              onInput={handleInput}
              onKeyUp={updateToolbarState}
              onMouseUp={updateToolbarState}
              data-placeholder="Start writing..."
              spellCheck
            />
          )}

          <div className="status-bar">
            <span>{wordCount} words</span>
            <span>{charCount} characters</span>
          </div>
        </div>
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

      {deleteTarget !== null && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">Delete note</h3>
            <p className="modal-desc">
              Are you sure you want to delete this note? This can't be undone.
            </p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn--cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="modal-btn modal-btn--confirm" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
