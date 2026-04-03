function SuccessPage() {
  const sessionId = new URLSearchParams(window.location.search).get("session_id");

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-logo">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="20" fill="#0e5a9c" />
            <text x="50" y="68" textAnchor="middle" fill="white" fontSize="48" fontFamily="monospace" fontWeight="700">W</text>
          </svg>
          Focused Writer
        </div>
        <div className="nav-links">
          <a href="https://github.com/scottschindler/focused-writer">GitHub</a>
        </div>
      </nav>

      <section className="hero">
        <span className="hero-badge">Thank you!</span>
        <h1>Your download is <span>ready</span></h1>
        <p>
          Thanks for purchasing Focused Writer. Click below to download the app.
        </p>
        <div className="hero-cta">
          <a className="btn-primary" href={`/api/download?session_id=${sessionId}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download for macOS
          </a>
        </div>
        <span className="hero-platform">macOS 10.13+ &middot; Apple Silicon &middot; 13 MB</span>
      </section>
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
              href="/api/checkout"
            >
              Buy for Mac
            </a>
            <span className="price">$10 one time</span>
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
        <span>Focused Writer © 2026</span>
      </footer>
    </div>
  );
}

export default App;
