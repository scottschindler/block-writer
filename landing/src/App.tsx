function App() {
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
        <span className="hero-badge">macOS native app</span>
        <h1>Write without <span>distractions</span></h1>
        <p>
          A focused text editor that blocks everything else on your Mac
          until your writing session is done. No notifications, no temptation.
        </p>
        <div className="hero-cta">
          <a className="btn-primary" href="https://github.com/scottschindler/focused-writer/releases/latest/download/Focused_Writer_1.0.0_aarch64.dmg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download for macOS
          </a>
          <a className="btn-secondary" href="https://github.com/scottschindler/focused-writer">View on GitHub</a>
        </div>
        <span className="hero-platform">macOS 10.13+ &middot; Apple Silicon &middot; 13 MB</span>
      </section>

      <section className="features">
        <div className="feature">
          <div className="feature-icon">&#128274;</div>
          <h3>Enforced Focus</h3>
          <p>
            Starts a countdown session. During that time, newly launched apps
            are killed instantly. Your editor stays on top.
          </p>
        </div>
        <div className="feature">
          <div className="feature-icon">&#9201;</div>
          <h3>Timed Sessions</h3>
          <p>
            Pick a duration: 5, 15, 25, or 60 minutes. The timer lives in
            Rust, not JavaScript — it can&#39;t be bypassed.
          </p>
        </div>
        <div className="feature">
          <div className="feature-icon">&#128275;</div>
          <h3>Passphrase Exit</h3>
          <p>
            To quit during a session, you must type "END SESSION". No
            accidental closes, no X-button escapes.
          </p>
        </div>
        <div className="feature">
          <div className="feature-icon">&#128196;</div>
          <h3>Local Storage</h3>
          <p>
            Documents saved to a local SQLite database. Nothing leaves your
            Mac. No accounts, no sync, no cloud.
          </p>
        </div>
        <div className="feature">
          <div className="feature-icon">&#127912;</div>
          <h3>Dark Theme</h3>
          <p>
            A VS Code–inspired dark interface that gets out of the way.
            Monospaced font, generous padding, minimal chrome.
          </p>
        </div>
        <div className="feature">
          <div className="feature-icon">&#128640;</div>
          <h3>Tiny & Fast</h3>
          <p>
            Built with Tauri v2, Rust, and React. 13 MB download. No
            Electron, no Node runtime, no bloat.
          </p>
        </div>
      </section>

      <footer className="footer">
        Focused Writer &middot; Built with Tauri v2 + Rust + React
      </footer>
    </div>
  );
}

export default App;
