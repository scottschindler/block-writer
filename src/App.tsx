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

const PASSPHRASE_WORDS = [
  "amber", "bridge", "castle", "delta", "ember", "frost", "grove", "hatch",
  "ivory", "junco", "knelt", "latch", "marsh", "noble", "orbit", "plank",
  "quartz", "ridge", "storm", "thorn", "umbra", "vault", "whisk", "xenon",
  "yacht", "zephyr", "blaze", "crest", "drift", "flint", "gleam", "haste",
  "jolts", "knack", "lunar", "mount", "nexus", "optic", "prism", "quest",
  "raven", "shard", "trove", "unfit", "vigor", "whelp", "axiom", "brisk",
];

function generatePassphrase(): string {
  const words: string[] = [];
  for (let i = 0; i < 20; i++) {
    const idx = Math.floor(Math.random() * PASSPHRASE_WORDS.length);
    let word = PASSPHRASE_WORDS[idx];
    // Randomly capitalize some words
    if (Math.random() < 0.3) word = word.charAt(0).toUpperCase() + word.slice(1);
    // Randomly add a digit suffix
    if (Math.random() < 0.2) word += Math.floor(Math.random() * 10);
    words.push(word);
  }
  return words.join(" ");
}

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
  const autosaveTimer = useRef<number | null>(null);
  const currentDocIdRef = useRef<number | null>(null);
  const switchInFlight = useRef<Promise<void> | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [expectedPassphrase, setExpectedPassphrase] = useState("");
  const [modalError, setModalError] = useState("");
  const [exitIntent, setExitIntent] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; docId: number } | null>(null);

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

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertText", false, "    ");
    }
  }, []);

  const insertTodo = useCallback(() => {
    if (!contentRef.current) return;
    contentRef.current.focus();
    document.execCommand("insertHTML", false, '<input type="checkbox">&nbsp;');
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

  useEffect(() => {
    currentDocIdRef.current = docId;
  }, [docId]);

  const flushCurrent = useCallback(async () => {
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    const id = currentDocIdRef.current;
    const el = contentRef.current;
    if (id === null || !el) return;
    if (!dirty.current) return;
    const html = el.innerHTML;
    const text = el.innerText || "";
    const firstLine = text.split("\n").find((l) => l.trim() !== "") || "";
    const freshTitle = firstLine.trim().substring(0, 100);
    try {
      await invoke("update_document", { id, title: freshTitle, content: html });
      dirty.current = false;
      contentHtml.current = html;
    } catch (e) {
      setStatus("Save failed");
      throw e;
    }
  }, []);

  const save = useCallback(async () => {
    if (currentDocIdRef.current === null) return;
    setStatus("Saving...");
    try {
      await flushCurrent();
      setStatus("Saved");
      await loadDocs();
      setTimeout(() => setStatus(""), 1500);
    } catch {
      setTimeout(() => setStatus(""), 2000);
    }
  }, [flushCurrent, loadDocs]);

  const createNew = useCallback(async () => {
    if (switchInFlight.current) {
      try { await switchInFlight.current; } catch {}
    }
    try { await flushCurrent(); } catch { return; }
    const id = await invoke<number>("create_document");
    setDocId(id);
    setTitle("");
    contentHtml.current = "";
    if (contentRef.current) {
      contentRef.current.innerHTML = "";
    }
    updateCounts();
    await loadDocs();
  }, [flushCurrent, loadDocs, updateCounts]);

  const switchDoc = useCallback(async (doc: Document) => {
    if (switchInFlight.current) {
      try { await switchInFlight.current; } catch {}
    }
    if (doc.id === currentDocIdRef.current) return;
    const run = (async () => {
      try {
        await flushCurrent();
      } catch {
        return;
      }
      const documents = await loadDocs();
      const fresh = documents.find((d) => d.id === doc.id) ?? doc;
      loadDocument(fresh);
      updateCounts();
    })();
    switchInFlight.current = run;
    try {
      await run;
    } finally {
      if (switchInFlight.current === run) switchInFlight.current = null;
    }
  }, [flushCurrent, loadDocument, loadDocs, updateCounts]);

  const confirmDelete = useCallback(async () => {
    if (deleteTarget === null) return;
    if (switchInFlight.current) {
      try { await switchInFlight.current; } catch {}
    }
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
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setCtxMenu(null); };
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onEsc);
    };
  }, [ctxMenu]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onChange = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.tagName !== "INPUT") return;
      const cb = target as HTMLInputElement;
      if (cb.type !== "checkbox") return;
      if (cb.checked) cb.setAttribute("checked", "");
      else cb.removeAttribute("checked");
      contentHtml.current = el.innerHTML;
      dirty.current = true;
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = window.setTimeout(() => {
        autosaveTimer.current = null;
        flushCurrent().catch(() => {});
      }, 500);
    };
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, [flushCurrent]);

  const isActiveRef = useRef(false);
  isActiveRef.current = session.state === "active";

  useEffect(() => {
    const hide = () => {
      if (isActiveRef.current) {
        contentRef.current?.classList.add("editor--cursor-hidden");
      }
    };
    const show = () => {
      contentRef.current?.classList.remove("editor--cursor-hidden");
    };

    window.addEventListener("keydown", hide);
    window.addEventListener("mousemove", show);

    return () => {
      window.removeEventListener("keydown", hide);
      window.removeEventListener("mousemove", show);
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("show-exit-passphrase-modal", () => {
      setExitIntent(true);
      setExpectedPassphrase(generatePassphrase());
      setShowModal(true);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const handleConfirm = async () => {
    try {
      if (exitIntent) {
        await invoke("unlock_quit", { passphrase, expectedPassphrase });
        setShowModal(false);
        setPassphrase("");
        setModalError("");
        try { await flushCurrent(); } catch {}
        await getCurrentWindow().close();
      } else {
        await interrupt(passphrase, expectedPassphrase);
        setShowModal(false);
        setPassphrase("");
        setModalError("");
      }
    } catch {
      setModalError("Incorrect passphrase");
    }
  };

  const openEndSessionModal = () => {
    setExitIntent(false);
    setExpectedPassphrase(generatePassphrase());
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
      if (autosaveTimer.current !== null) {
        window.clearTimeout(autosaveTimer.current);
      }
      autosaveTimer.current = window.setTimeout(() => {
        autosaveTimer.current = null;
        flushCurrent().catch(() => {});
      }, 1000);
      updateCounts();
      // Derive title from first line of text
      const text = contentRef.current.innerText || "";
      const firstLine = text.split("\n").find((l) => l.trim() !== "") || "";
      const newTitle = firstLine.trim().substring(0, 100);
      setTitle(newTitle);
      // Update sidebar title live + move edited doc to the top
      if (docId !== null) {
        setDocs((prev) => {
          const idx = prev.findIndex((d) => d.id === docId);
          if (idx < 0) return prev;
          const doc = prev[idx];
          const nextTitle = newTitle || doc.title;
          if (idx === 0 && doc.title === nextTitle) return prev;
          const updated = [...prev];
          updated.splice(idx, 1);
          updated.unshift({ ...doc, title: nextTitle });
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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCtxMenu({ x: e.clientX, y: e.clientY, docId: doc.id });
                  }}
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
            <ToolbarButton
              label="☐"
              onClick={insertTodo}
              title="Todo item"
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
                  You've used your 3 free sessions. Get lifetime access to Block Writer for a one-time payment of $15.
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
              onKeyDown={handleEditorKeyDown}
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

      {ctxMenu && (
        <div
          className="ctx-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            className="ctx-menu-item"
            onClick={() => {
              setDeleteTarget(ctxMenu.docId);
              setCtxMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">{exitIntent ? "Quit App" : "End Session"}</h3>
            <p className="modal-desc">
              Type the following exactly to confirm:
            </p>
            <code className="modal-passphrase">{expectedPassphrase}</code>
            <input
              className="modal-input"
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.target.value);
                setModalError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              onPaste={(e) => e.preventDefault()}
              placeholder=""
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
