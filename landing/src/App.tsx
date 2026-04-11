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
          href="https://github.com/scottschindler/focused-writer/releases/latest/download/Focused-Writer-mac-arm64.dmg"
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
              href="https://github.com/scottschindler/focused-writer/releases/latest/download/Focused-Writer-mac-arm64.dmg"
            >
              Download for Mac
            </a>
            <span className="price">3 free sessions, then $15</span>
          </div>
          <p className="install-hint">Open the downloaded file and drag Focused Writer to Applications.</p>
        </div>

      </main>

      <footer className="footer">
        <span>Focused Writer &copy; 2026</span>
      </footer>
    </div>
  );
}

export default App;
