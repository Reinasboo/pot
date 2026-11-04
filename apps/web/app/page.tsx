export const metadata = {
  title: "POT — Shared plans, clear money rules",
  description:
    "Plan a group pot with visible goals and settlement rules. POT is an early Base Sepolia prototype; live payments are not available.",
};

const useCases = [
  {
    number: "01",
    title: "Group gifts",
    description: "Make the birthday surprise about the person, not the payment chase.",
  },
  {
    number: "02",
    title: "Trips together",
    description: "Bring the shared plan and everyone’s contributions into one place.",
  },
  {
    number: "03",
    title: "Community events",
    description: "Give your group a clear goal, a simple way to chip in, and a shared view of progress.",
  },
  {
    number: "04",
    title: "Shared purchases",
    description: "Coordinate the costs of the things your friends, family, or team need together.",
  },
];

const roadmap = [
  {
    number: "01",
    status: "Prototype",
    title: "Clear pot rules",
    description: "The first step is making a shared plan and its settlement terms easy to understand.",
    items: ["Local rules preview", "Goal and deadline options", "Public pot page prototype", "No live payments yet"],
    current: true,
  },
  {
    number: "02",
    status: "Planned",
    title: "Social experience",
    description: "Make shared progress more visible, celebratory, and easy to pass along.",
    items: ["Activity feeds", "Reactions and milestones", "Shareable cards", "Public pot discovery"],
    current: false,
  },
  {
    number: "03",
    status: "Planned",
    title: "Organizers and businesses",
    description: "More useful tools for the people bringing groups together.",
    items: ["Creator collections", "Organizer analytics", "Branded pot pages", "Premium management tools"],
    current: false,
  },
  {
    number: "04",
    status: "Future vision",
    title: "POT infrastructure",
    description: "Make group payments useful in more products and experiences.",
    items: ["Developer API", "Embedded collections", "Merchant integrations", "Additional network support"],
    current: false,
  },
];

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M4.25 10h11.5m-4.75-4.75L15.75 10 11 14.75" />
    </svg>
  );
}

function PotMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="POT home">
          <PotMark />
          <span>POT</span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#rules">Clear rules</a>
          <a href="/dashboard">My pots</a>
        </nav>
        <div className="site-header-actions">
          <a className="header-dashboard-link" href="/dashboard">My pots</a>
          <a className="header-link" href="/create">
            Plan a pot <ArrowIcon />
          </a>
        </div>
      </header>

      <section className="hero section-wrap" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> A group payments prototype</p>
          <h1>Make a plan.<br />Keep the <span>rules clear.</span></h1>
          <p className="hero-description">
            POT is being built to help groups set a shared goal, understand what happens to the
            money, and follow contributions once payments are live.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/create">
              Plan a pot <ArrowIcon />
            </a>
            <a className="text-link" href="/dashboard">View your pots</a>
          </div>
          <div className="hero-proof">
            <div className="proof-mark"><span>◎</span></div>
            <p><strong>Planning stays on this device.</strong><br />No wallet request or payment is made.</p>
          </div>
        </div>

        <div className="preview-wrap" aria-label="Example of POT settlement rules">
          <article className="pot-preview">
            <div className="preview-topline">
              <span className="preview-label">HOW SETTLEMENT RULES WORK</span>
              <span className="preview-menu" aria-hidden="true">POT</span>
            </div>
            <div className="preview-rules-header">
              <span className="preview-rule-mark" aria-hidden="true">01</span>
              <div>
                <p className="preview-overline">ONE SHARED PLAN</p>
                <h2>Agree on the rules first.</h2>
              </div>
            </div>
            <div className="preview-rule-list">
              <div className="preview-rule">
                <span>Goal-based</span>
                <p>Set a target and deadline. If the goal is missed, contributors may claim refunds after the deadline.</p>
              </div>
              <div className="preview-rule">
                <span>Flexible</span>
                <p>No target or automatic refund rule. The organizer may withdraw collected funds.</p>
              </div>
            </div>
            <a className="preview-create-link" href="/create">Preview your own rules <ArrowIcon /></a>
          </article>
          <p className="preview-note">Prototype rules only. No live pot or payment is shown.</p>
        </div>
      </section>

      <div className="trust-strip" aria-label="Current product status">
        <div className="trust-strip-inner">
          <span>Early prototype</span>
          <i />
          <span>Base Sepolia only</span>
          <i />
          <span>No live payments</span>
          <i />
          <span>Settlement token not configured</span>
        </div>
      </div>

      <section className="how-section section-wrap" id="how-it-works">
        <div className="section-heading">
          <p className="eyebrow">Start with the plan</p>
          <h2>Get aligned<br />before <span>money moves.</span></h2>
          <p>The prototype helps you think through the goal and settlement terms before payments are available.</p>
        </div>
        <div className="steps-grid">
          <article className="step-card">
            <span className="step-number">01 / PLAN</span>
            <div className="step-icon step-icon-create"><span>+</span></div>
            <h3>Write down the purpose</h3>
            <p>Give the group context and choose goal-based or flexible settlement rules.</p>
          </article>
          <article className="step-card">
            <span className="step-number">02 / REVIEW</span>
            <div className="step-icon step-icon-share"><span>↗</span><i /><i /></div>
            <h3>Check the terms together</h3>
            <p>Preview the target, deadline, and minimum contribution in plain language.</p>
          </article>
          <article className="step-card">
            <span className="step-number">03 / WHEN LIVE</span>
            <div className="step-icon step-icon-fund"><span>$</span><i /><i /><i /></div>
            <h3>Payments are a next step</h3>
            <p>Onchain creation and contributions are not enabled in this prototype.</p>
          </article>
        </div>
      </section>

      <section className="use-section" id="use-cases">
        <div className="section-wrap use-layout">
          <div className="use-intro">
            <p className="eyebrow">The best plans are shared</p>
            <h2>For the things<br />you do <span>together.</span></h2>
            <p>Big moments, small plans, and everything your group wants to make happen.</p>
          </div>
          <div className="use-list">
            {useCases.map((useCase) => (
              <article className="use-case" key={useCase.number}>
                <span className="use-number">{useCase.number}</span>
                <div>
                  <h3>{useCase.title}</h3>
                  <p>{useCase.description}</p>
                </div>
                <ArrowIcon />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="trust-section section-wrap" id="rules">
        <div className="trust-copy">
          <p className="eyebrow">Rules should be visible</p>
          <h2>Know what<br />you’re agreeing <span>to.</span></h2>
          <p className="trust-description">
            POT is designed around explicit settlement conditions. Review the intended behavior
            below; the contracts are prototypes and have not been deployed.
          </p>
        </div>
        <div className="trust-points">
          <article>
            <span className="trust-icon">01</span>
            <div><h3>Goal-based</h3><p>The organizer can withdraw after the goal is met. If the deadline passes below the goal, contributors can claim refunds from the contract.</p></div>
          </article>
          <article>
            <span className="trust-icon">02</span>
            <div><h3>Flexible</h3><p>The organizer can withdraw contributed funds. This mode has no target or automatic refund rule.</p></div>
          </article>
          <article>
            <span className="trust-icon">03</span>
            <div><h3>Still in development</h3><p>No factory or settlement token is configured, and no live contributions, payouts, or refunds are available.</p></div>
          </article>
        </div>
      </section>

      <section className="roadmap-section" id="roadmap">
        <div className="section-wrap">
          <div className="roadmap-heading">
            <div>
              <p className="eyebrow">Built in stages, with purpose</p>
              <h2>Where POT is headed.</h2>
            </div>
            <p>Today’s focus is core group payments. The rest is a roadmap—not a promise that these features are live.</p>
          </div>
          <div className="roadmap-grid">
            {roadmap.map((stage) => (
              <article className={`roadmap-card${stage.current ? " roadmap-current" : ""}`} key={stage.number}>
                <div className="roadmap-card-top">
                  <span>{stage.number}</span>
                  <span className="roadmap-status">{stage.status}</span>
                </div>
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
                <ul>
                  {stage.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="closing-section section-wrap">
        <div className="closing-mark"><PotMark /></div>
        <p className="eyebrow">Start with a plan</p>
        <h2>Make the rules<br /><span>easy to share.</span></h2>
        <a className="button button-dark" href="/create">Plan a pot <ArrowIcon /></a>
        <p className="closing-note">Local draft only. No wallet request or payment is made.</p>
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top" aria-label="POT home">
          <PotMark /><span>POT</span>
        </a>
        <p>Money moves better together.</p>
        <div className="footer-links">
          <a href="#how-it-works">How it works</a>
          <a href="#roadmap">Roadmap</a>
        </div>
        <span className="footer-note">A work in progress. No live contributions yet.</span>
      </footer>
    </main>
  );
}
