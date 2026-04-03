function SuccessPage() {
  const sessionId = new URLSearchParams(window.location.search).get("session_id");

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-logo">
          <span className="nav-logo-dot" />
          <span className="nav-logo-text">Focused Writer</span>
        </div>
      </nav>

      <main className="hero">
        <div className="hero-left">
          <h1>You're activated.</h1>
          <p>
            Copy the activation code below and paste it into the Focused Writer
            app to unlock unlimited sessions.
          </p>
          <div className="activation-code">
            <code>{sessionId}</code>
            <button
              className="btn-copy"
              onClick={() => navigator.clipboard.writeText(sessionId || "")}
            >
              Copy
            </button>
          </div>
          <p className="hint">
            Open Focused Writer and paste this code in the activation field.
          </p>
        </div>
      </main>

      <footer className="footer">
        <span>Focused Writer &copy; 2026</span>
      </footer>
    </div>
  );
}

function App() {
  if (window.location.pathname === "/success") {
    return <SuccessPage />;
  }

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-logo">
          <span className="nav-logo-dot" />
          <span className="nav-logo-text">Focused Writer</span>
        </div>
        <a
          className="btn-nav"
          href="https://github.com/scottschindler/focused-writer/releases/latest/download/Focused_Writer_1.0.0_aarch64.dmg"
        >
          Download
        </a>
      </nav>

      <main className="hero">
        <div className="hero-left">
          <h1>Just write.</h1>
          <p>
            A minimalist desktop environment that enforces focus at the system
            level. You set the timer. We block all other applications. No
            alt-tabbing. No exiting. Nothing but a blank screen and your words
            until the clock hits zero.
          </p>
          <div className="cta-group">
            <a
              className="btn-download"
              href="https://github.com/scottschindler/focused-writer/releases/latest/download/Focused_Writer_1.0.0_aarch64.dmg"
            >
              Download for Mac
            </a>
            <span className="price">3 free sessions, then $10</span>
          </div>
        </div>

        <div className="hero-right">
          <div className="app-window">
            <div className="window-chrome">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <div className="window-body">
              <div className="timer-bar">
                <span className="timer-label">SESSION</span>
                <span className="timer-value">25:00</span>
              </div>
              <div className="editor-area">
                <div className="cursor-line">
                  <span className="editor-text">The quick brown fox</span>
                  <span className="cursor" />
                </div>
              </div>
              <div className="locked-bar">
                <span className="locked-dot" />
                SYSTEM LOCKED
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <span>Focused Writer &copy; 2026</span>
      </footer>
    </div>
  );
}

export default App;
