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

      <Footer />
    </div>
  );
}

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-logo">
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="nav-logo-dot" />
            <span className="nav-logo-text">Block Writer</span>
          </a>
        </div>
      </nav>

      <main className="legal">
        <h1>{title}</h1>
        {children}
      </main>

      <Footer />
    </div>
  );
}

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p><strong>Last updated:</strong> April 13, 2026</p>

      <h2>Overview</h2>
      <p>
        Block Writer is a desktop application for macOS. We are committed to
        protecting your privacy. This policy explains what data we collect and
        how we use it.
      </p>

      <h2>Data We Collect</h2>
      <p>
        <strong>Payment information:</strong> When you purchase a license, your
        payment is processed by Stripe. We do not store your credit card number
        or billing details. Stripe's privacy policy governs how your payment
        data is handled.
      </p>
      <p>
        <strong>Activation code:</strong> After purchase, a Stripe checkout
        session ID is used as your activation code. This is stored locally on
        your device to verify your license.
      </p>
      <p>
        <strong>Documents and content:</strong> All documents you create in
        Block Writer are stored locally on your Mac in a SQLite database. We
        never transmit, access, or store your writing content on any server.
      </p>

      <h2>Data We Do Not Collect</h2>
      <ul>
        <li>We do not collect analytics or usage data</li>
        <li>We do not use cookies or tracking technologies</li>
        <li>We do not collect personal information beyond what Stripe processes for payment</li>
        <li>We do not have access to your documents or writing</li>
      </ul>

      <h2>Network Requests</h2>
      <p>Block Writer makes network requests in two cases only:</p>
      <ul>
        <li><strong>License activation:</strong> When you enter an activation code, the app contacts our server to verify the payment was completed.</li>
        <li><strong>Update checks:</strong> The app checks GitHub for new versions on launch.</li>
      </ul>

      <h2>Third-Party Services</h2>
      <ul>
        <li><strong>Stripe:</strong> Payment processing. See <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe's Privacy Policy</a>.</li>
        <li><strong>GitHub:</strong> Application distribution and updates.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        If you have questions about this privacy policy, contact us at{" "}
        <a href="mailto:scottschindler29@gmail.com">scottschindler29@gmail.com</a>.
      </p>
    </LegalPage>
  );
}

function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p><strong>Last updated:</strong> April 13, 2026</p>

      <h2>Agreement</h2>
      <p>
        By downloading, installing, or using Block Writer, you agree to these
        terms. If you do not agree, do not use the application.
      </p>

      <h2>License</h2>
      <p>
        Block Writer offers 3 free writing sessions. After that, a one-time
        payment of $15 grants you a lifetime license to use the application.
        The license is for personal use and is non-transferable.
      </p>

      <h2>How It Works</h2>
      <p>
        Block Writer enforces focus by blocking other applications during a
        writing session. When you start a session, the app will prevent you
        from switching to other apps until the timer expires. You can end a
        session early by typing a passphrase displayed in the app.
      </p>

      <h2>Disclaimer</h2>
      <p>
        Block Writer is provided "as is" without warranty of any kind. We are
        not responsible for any data loss, interruption of work, or other
        damages arising from the use of this application. The app terminates
        other running processes during a session — please save your work in
        other applications before starting a session.
      </p>

      <h2>Refunds</h2>
      <p>
        If you are unsatisfied with Block Writer, contact us within 30 days of
        purchase at{" "}
        <a href="mailto:scottschindler29@gmail.com">scottschindler29@gmail.com</a>{" "}
        for a full refund.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms from time to time. Continued use of Block
        Writer after changes constitutes acceptance of the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Reach us at{" "}
        <a href="mailto:scottschindler29@gmail.com">scottschindler29@gmail.com</a>.
      </p>
    </LegalPage>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <span>Block Writer &copy; 2026</span>
      <span style={{ display: "flex", gap: 16, marginLeft: "auto" }}>
        <a href="/privacy" style={{ color: "#888" }}>Privacy</a>
        <a href="/terms" style={{ color: "#888" }}>Terms</a>
        <a href="mailto:scottschindler29@gmail.com" style={{ color: "#888" }}>Support</a>
      </span>
    </footer>
  );
}

function App() {
  const path = window.location.pathname;

  if (path === "/success") return <SuccessPage />;
  if (path === "/privacy") return <PrivacyPage />;
  if (path === "/terms") return <TermsPage />;

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

      <Footer />
    </div>
  );
}

export default App;
