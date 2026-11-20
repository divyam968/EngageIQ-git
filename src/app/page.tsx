const signals = [
  { label: "Positive", value: "68%", className: "positive" },
  { label: "Curious", value: "24%", className: "curious" },
  { label: "Critical", value: "8%", className: "critical" },
]

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <a aria-label="EngageIQ home" className="brand" href="#home">
          <span aria-hidden="true" className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span>Engage<span className="brand-accent">IQ</span></span>
        </a>
        <nav aria-label="Main navigation" className="main-nav">
          <a href="#platform">Platform</a>
          <a href="#insights">Insights</a>
          <a href="#about">About</a>
        </nav>
        <a className="header-cta" href="#insights">
          Explore insights <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section aria-labelledby="hero-title" className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Audience intelligence, made clear</p>
          <h1 id="hero-title">
            Make every
            <br />
            <span>signal count.</span>
          </h1>
          <p className="hero-description">
            Go beyond views. Understand what your audience feels, what they
            value, and what they want to see next.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#insights">
              Discover your insights <span aria-hidden="true">→</span>
            </a>
            <a className="text-link" href="#platform">
              See how it works <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="hero-proof">
            <div aria-hidden="true" className="proof-avatars">
              <span>A</span><span>M</span><span>J</span>
            </div>
            <p><strong>Built for curious creators</strong><br />Make better content decisions with confidence.</p>
          </div>
        </div>

        <div aria-label="Example audience insights dashboard" className="insight-preview" id="insights">
          <div className="preview-topline">
            <div>
              <p className="preview-kicker">AUDIENCE PULSE</p>
              <h2>Your latest signals</h2>
            </div>
            <span className="live-indicator"><i /> Live overview</span>
          </div>
          <div className="sentiment-card">
            <div className="card-heading">
              <div>
                <p className="card-label">Audience sentiment</p>
                <p className="sentiment-value">68% <span>positive</span></p>
              </div>
              <span aria-hidden="true" className="sentiment-icon">✳</span>
            </div>
            <div aria-label="Sentiment: 68 percent positive, 24 percent curious, 8 percent critical" className="sentiment-bar">
              <span className="positive" />
              <span className="curious" />
              <span className="critical" />
            </div>
            <ul className="signal-legend">
              {signals.map((signal) => (
                <li key={signal.label}>
                  <span className={`legend-dot ${signal.className}`} />
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="preview-bottom">
            <div className="topic-card">
              <div className="card-heading">
                <p className="card-label">What resonates</p>
                <span className="trend-label">↑ Trending</span>
              </div>
              <p className="topic-name">Behind the process</p>
              <p className="topic-detail">More meaningful conversations this week</p>
              <div aria-hidden="true" className="sparkline">
                <span /><span /><span /><span /><span /><span /><span /><span />
              </div>
            </div>
            <div className="recommendation-card">
              <span aria-hidden="true" className="recommendation-icon">✦</span>
              <p className="card-label">A thought to take away</p>
              <p>Your audience is asking for more <strong>real-world examples.</strong></p>
            </div>
          </div>
          <div aria-hidden="true" className="preview-decoration">IQ</div>
        </div>
      </section>

      <section aria-labelledby="platform-title" className="platform-section" id="platform">
        <div className="section-intro">
          <p className="eyebrow"><span /> From data to direction</p>
          <h2 id="platform-title">Know the <span>why</span> behind every view.</h2>
          <p>
            EngageIQ brings your audience signals together, so the next idea
            starts with understanding—not guesswork.
          </p>
        </div>
        <div className="feature-grid">
          <article className="feature-card">
            <span aria-hidden="true" className="feature-number">01</span>
            <h3>Listen closer</h3>
            <p>Surface the themes, questions, and reactions that matter in audience conversations.</p>
            <a href="#about">Explore audience signals <span aria-hidden="true">→</span></a>
          </article>
          <article className="feature-card feature-card-highlight">
            <span aria-hidden="true" className="feature-number">02</span>
            <h3>Spot what connects</h3>
            <p>See how sentiment and engagement shift across your videos and content.</p>
            <a href="#about">Explore content insights <span aria-hidden="true">→</span></a>
          </article>
          <article className="feature-card">
            <span aria-hidden="true" className="feature-number">03</span>
            <h3>Plan with purpose</h3>
            <p>Turn real audience feedback into thoughtful ideas for what to create next.</p>
            <a href="#about">Explore recommendations <span aria-hidden="true">→</span></a>
          </article>
        </div>
      </section>

      <section aria-labelledby="about-title" className="closing-section" id="about">
        <div>
          <p className="eyebrow"><span /> A little more insight. A lot more intention.</p>
          <h2 id="about-title">Create what your audience <span>actually cares about.</span></h2>
        </div>
        <a className="button button-light" href="#home">
          Back to the top <span aria-hidden="true">↑</span>
        </a>
      </section>

      <footer className="site-footer">
        <a aria-label="EngageIQ home" className="brand footer-brand" href="#home">
          <span aria-hidden="true" className="brand-mark"><span /><span /><span /></span>
          <span>Engage<span className="brand-accent">IQ</span></span>
        </a>
        <p>Understand more. Create with intention.</p>
        <span>© {new Date().getFullYear()} EngageIQ</span>
      </footer>
    </main>
  )
}
