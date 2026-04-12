function SuccessPage() {
  const sessionId = new URLSearchParams(window.location.search).get("session_id");

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-logo">
          <span className="nav-logo-dot" />
          <span className="nav-logo-text">Block Writer</span>
        </div>
      </nav>

      <main className="hero">
        <div className="hero-left">
          <h1>You're activated.</h1>
          <p>
            Copy the activation code below and paste it into the Block Writer
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
            Open Block Writer and paste this code in the activation field.
          </p>
        </div>
      </main>

      <footer className="footer">
        <span>Block Writer &copy; 2026</span>
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
          <span className="nav-logo-text">Block Writer</span>
        </div>
        <a
          className="btn-nav"
          href="https://github.com/scottschindler/focused-writer/releases/latest/download/Block-Writer-mac-arm64.dmg"
        >
          Download
        </a>
      </nav>

      <main className="hero">
        <div className="hero-left">
          <h1>Just Write.<br />Block everything else.</h1>
          <p>
            A minimalist desktop environment that enforces focus at the system
            level. You set the timer. We block all other applications. No
            alt-tabbing. No exiting. Nothing but a blank screen and your words
            until the clock hits zero.
          </p>
          <div className="cta-group">
            <a
              className="btn-download"
              href="https://github.com/scottschindler/focused-writer/releases/latest/download/Block-Writer-mac-arm64.dmg"
            >
              Download for Mac
            </a>
            <span className="price">3 free sessions, then $15 for lifetime access</span>
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
              <div className="demo-layout">
                <div className="demo-sidebar">
                  <div className="demo-sidebar-header">
                    <span className="demo-sidebar-toggle">&#8249;</span>
                    <span className="demo-sidebar-new">+</span>
                  </div>
                  <div className="demo-sidebar-item demo-sidebar-item--active">
                    <span className="demo-sidebar-title">Morning pages</span>
                    <span className="demo-sidebar-date">Just now</span>
                  </div>
                  <div className="demo-sidebar-item">
                    <span className="demo-sidebar-title">Chapter 3 draft</span>
                    <span className="demo-sidebar-date">2h ago</span>
                  </div>
                  <div className="demo-sidebar-item">
                    <span className="demo-sidebar-title">Story ideas</span>
                    <span className="demo-sidebar-date">Mar 28</span>
                  </div>
                </div>
                <div className="demo-main">
                  <div className="demo-fmt-bar">
                    <span className="demo-fmt-btn">H1</span>
                    <span className="demo-fmt-btn">H2</span>
                    <span className="demo-fmt-sep" />
                    <span className="demo-fmt-btn demo-fmt-btn--active">B</span>
                    <span className="demo-fmt-btn">I</span>
                    <span className="demo-fmt-btn">U</span>
                    <span className="demo-fmt-btn">S</span>
                  </div>
                  <div className="demo-session-bar">
                    <span className="demo-timer">18:42</span>
                    <span className="demo-end-btn">End Session</span>
                  </div>
                  <div className="editor-area">
                    <p className="editor-text editor-text--heading">Morning pages</p>
                    <p className="editor-text">
                      The café was nearly empty when I sat down. Just me, a cold
                      glass of water, and the hum of the espresso machine. I
                      hadn't written anything in weeks — not because I had nothing
                      to say, but because everything felt too tangled to
                      untangle.<span className="cursor" />
                    </p>
                  </div>
                  <div className="demo-status-bar">
                    <span>47 words</span>
                    <span>284 characters</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <span>Block Writer &copy; 2026</span>
      </footer>
    </div>
  );
}

export default App;
