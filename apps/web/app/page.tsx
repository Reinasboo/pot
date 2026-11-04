import { RoadmapSection } from "@/components/roadmap-section";

export const metadata = {
  title: "POT — Plan a group fund",
  description:
    "Set a group funding goal, deadline, and refund rules. Preview a plan for a trip, gift, or event. Live pots and payments are not available yet.",
};

const useCases = [
  {
    number: "01",
    title: "Group gifts",
    description: "Set a shared budget for a gift and show everyone the goal and deadline.",
  },
  {
    number: "02",
    title: "Trips together",
    description: "Agree on the trip budget, who can add money, and what happens if you miss the goal.",
  },
  {
    number: "03",
    title: "Crowdfunding",
    description:
      "Preview who receives the funds and whether the approved wallet can withdraw at the deadline or as money comes in.",
  },
  {
    number: "04",
    title: "Community events",
    description: "Set a target for venue costs, supplies, or tickets before you collect money.",
  },
  {
    number: "05",
    title: "Apps for groups",
    description: "A shared POT API could let other apps offer group funds. It’s a future idea, not a feature you can use today.",
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
          <a href="#how-it-works">What works today</a>
          <a href="#rules">How the rules work</a>
          <a href="/discover">Discover pots</a>
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
          <p className="eyebrow"><span className="status-dot" /> Plan the money before your group pays</p>
          <h1>Plan a trip,<br />gift, or event<br /><span>together.</span></h1>
          <p className="hero-description">
            Set a goal and deadline. Decide who can withdraw the money and what happens if you
            fall short. Preview the plan now; collecting payments isn’t available yet.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/create">
              Preview your plan <ArrowIcon />
            </a>
            <a className="text-link" href="#how-it-works">See how it works</a>
          </div>
          <div className="hero-proof">
            <div className="proof-mark"><span>◎</span></div>
            <p><strong>Your plan stays in this browser.</strong><br />Previewing does not connect a wallet or move money.</p>
          </div>
        </div>

        <div className="preview-wrap" aria-label="Example of what happens to the money">
          <article className="pot-preview">
            <div className="preview-topline">
              <span className="preview-label">WHAT HAPPENS TO THE MONEY?</span>
              <span className="preview-menu" aria-hidden="true">POT</span>
            </div>
            <div className="preview-rules-header">
              <span className="preview-rule-mark" aria-hidden="true">01</span>
              <div>
                <p className="preview-overline">THREE WAYS TO SET THE RULES</p>
                <h2>Choose who can withdraw—and when.</h2>
              </div>
            </div>
            <div className="preview-rule-list">
              <div className="preview-rule">
                <span>Goal + deadline with refunds</span>
                <p>If the goal is missed, each contributor can claim back their own contribution. Refunds are not automatic.</p>
              </div>
              <div className="preview-rule">
                <span>Crowdfund to a deadline</span>
                <p>The goal is a target, not a cap. Contributions stay open until the deadline; the named wallet can then withdraw all funds. No refunds.</p>
              </div>
              <div className="preview-rule">
                <span>Crowdfund with early withdrawals</span>
                <p>The goal is a target, not a cap. The named wallet can withdraw available funds at any time, while contributions stay open until the deadline. No refunds.</p>
              </div>
            </div>
            <a className="preview-create-link" href="/create">Build a plan preview <ArrowIcon /></a>
          </article>
          <p className="preview-note">These are rule examples—not an active pot. No payment can be made.</p>
        </div>
      </section>

      <div className="trust-strip" aria-label="Current product status">
        <div className="trust-strip-inner">
          <span>Plan previews work</span>
          <i />
          <span>No live payments</span>
          <i />
          <span>No pots can be created yet</span>
        </div>
      </div>

      <section className="how-section section-wrap" id="how-it-works">
        <div className="section-heading">
          <p className="eyebrow">What you can do today</p>
          <h2>Try the plan.<br />Payments are <span>not live.</span></h2>
          <p>Enter a name, goal, deadline, and minimum contribution to preview the rules. The preview is saved only if you choose to save it in this browser. You cannot publish a pot or collect money yet.</p>
        </div>
        <div className="steps-grid">
          <article className="step-card">
            <span className="step-number">01 / ENTER DETAILS</span>
            <div className="step-icon step-icon-create"><span>+</span></div>
            <h3>Describe what the group is funding</h3>
            <p>Name the trip, gift, or fundraiser. Choose whether a missed goal means a refund or the named crowdfunding wallet can still withdraw.</p>
          </article>
          <article className="step-card">
            <span className="step-number">02 / PREVIEW RULES</span>
            <div className="step-icon step-icon-share"><span>↗</span><i /><i /></div>
            <h3>See the exact terms</h3>
            <p>Review the goal, deadline, minimum amount per contribution, and who can withdraw or claim a refund.</p>
          </article>
          <article className="step-card">
            <span className="step-number">03 / NOT AVAILABLE YET</span>
            <div className="step-icon step-icon-fund"><span>$</span><i /><i /><i /></div>
            <h3>You cannot create or fund it yet</h3>
            <p>You can plan and preview a pot, but real payments are not available yet. Do not send money expecting this site to manage it.</p>
          </article>
        </div>
      </section>

      <section className="use-section" id="use-cases">
        <div className="section-wrap use-layout">
          <div className="use-intro">
            <p className="eyebrow">Examples to plan for</p>
            <h2>One shared goal<br />for <span>your group.</span></h2>
            <p>Use the preview to write down what you are collecting for and agree on the rules before anyone pays.</p>
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
          <p className="eyebrow">Read this before anyone contributes</p>
          <h2>Know who can take out<br />or get back <span>the money.</span></h2>
          <p className="trust-description">
            These are examples to help your group agree on the rules. Real payments are not
            available yet, so the rules do not protect money sent through this site.
          </p>
        </div>
        <div className="trust-points">
          <article>
            <span className="trust-icon">01</span>
            <div><h3>Refund if the goal is missed</h3><p>If the deadline passes below the goal, each contributor can claim their own contribution back. Refunds are not automatic.</p></div>
          </article>
          <article>
            <span className="trust-icon">02</span>
            <div><h3>Crowdfund to a deadline</h3><p>The goal is a target, not a cap. Contributions stay open until the deadline, when the named wallet can withdraw all funds. Contributors cannot claim refunds.</p></div>
          </article>
          <article>
            <span className="trust-icon">03</span>
            <div><h3>Withdraw as crowdfunding comes in</h3><p>The goal is a target, not a cap. The named wallet can withdraw the available balance at any time, while contributions stay open until the deadline. Contributors cannot claim refunds.</p></div>
          </article>
        </div>
      </section>

      <RoadmapSection />

      <section className="closing-section section-wrap">
        <div className="closing-mark"><PotMark /></div>
        <p className="eyebrow">Try it without connecting a wallet</p>
        <h2>Preview your group-fund<br /><span>rules.</span></h2>
        <a className="button button-dark" href="/create">Open the plan preview <ArrowIcon /></a>
        <p className="closing-note">This only creates a preview in your browser. It does not create a public pot or collect money.</p>
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top" aria-label="POT home">
          <PotMark /><span>POT</span>
        </a>
        <p>Plan together before money moves.</p>
        <div className="footer-links">
          <a href="#how-it-works">How it works</a>
          <a href="/roadmap">Roadmap</a>
        </div>
        <span className="footer-note">Preview only. No pots or live payments are available.</span>
      </footer>
    </main>
  );
}
