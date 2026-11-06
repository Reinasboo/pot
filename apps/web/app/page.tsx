import { pageMetadata } from "@/lib/site-metadata";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { HomeProductPreview } from "@/components/home-product-preview";
import { TaglineReveal } from "@/components/tagline-reveal";

export const metadata = pageMetadata({
  title: "Big plans. One shared pot.",
  description:
    "Plan a shared gift, trip, or fundraiser with clear contribution and payout rules.",
  path: "/",
});

const rules = [
  {
    title: "Reach the goal, or claim a refund",
    detail:
      "The organizer can withdraw once the goal is reached. If the deadline passes below the goal, each contributor can claim their contribution back.",
    note: "Refunds must be claimed; they are not automatic.",
  },
  {
    title: "Collect until a deadline",
    detail:
      "Keep collecting until the deadline, even beyond the goal. After that, only the payout wallet you named can withdraw the funds.",
    note: "No contributor refunds, even if the goal is missed.",
  },
  {
    title: "Withdraw as funds come in",
    detail:
      "The named payout wallet can withdraw the available balance while contributions continue until the deadline. The goal is a soft target.",
    note: "No contributor refunds under this rule.",
  },
];

export default function Home() {
  return (
    <main className="home-page">
      <SiteHeader />
      <section className="hero section-wrap" id="main-content" tabIndex={-1}>
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> For the plans you make together
          </p>
          <h1>
            Big plans.
            <br />
            One shared <span>pot.</span>
          </h1>
          <p className="hero-description">
            The trip. The gift. The idea everyone’s in on. Give it one shared
            pot, a clear goal, and money rules everyone understands.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/create">
              Plan your pot <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <p className="hero-reassurance">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path d="m5 12 4 4L19 6" />
            </svg>
            No wallet needed to plan. Your draft stays yours.
          </p>
          <p className="home-availability">
            <span className="home-testnet-badge">Early access</span> Try the
            planner today. <strong>No live payments.</strong>
          </p>
        </div>
        <HomeProductPreview />
      </section>
      <div className="home-use-strip">
        <span>For the plans worth making.</span>
        <span>Group gifts</span>
        <span>Weekends away</span>
        <span>Community projects</span>
        <span>Something of your own</span>
      </div>
      <section className="section-wrap home-how" id="how-it-works">
        <div>
          <p className="eyebrow">Less chasing. More clarity.</p>
          <h2>
            Leave the awkward
            <br />
            <span>money chat behind.</span>
          </h2>
          <p>
            One person starts the plan. Everyone can understand the goal, the
            deadline, and what happens to the money. Fewer loose ends. More to
            look forward to.
          </p>
          <Link className="text-link" href="/create">
            Make your first plan <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <ol className="home-steps">
          <li>
            <span>1</span>
            <div>
              <h3>Give the idea a name</h3>
              <p>
                Write down what you’re funding, how much you need, and when you
                need it.
              </p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <h3>Agree on the money rules</h3>
              <p>
                Choose who can withdraw and whether contributors can claim a
                refund if the goal is missed.
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <h3>Bring everyone onto the same page</h3>
              <p>
                Preview the terms, save your draft, and copy or download the
                plan to share with your group.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="home-rules" id="rules">
        <div className="section-wrap">
          <div className="home-rules-heading">
            <p className="eyebrow">No guessing where the money goes</p>
            <h2>
              Different plans.
              <br />
              <span>Clear rules.</span>
            </h2>
            <p>
              Pick the rule that fits your group. Every contributor should know
              the terms before paying.
            </p>
          </div>
          <div className="home-rule-list">
            {rules.map((rule, index) => (
              <article key={rule.title}>
                <span className="home-rule-index">0{index + 1}</span>
                <h3>{rule.title}</h3>
                <div>
                  <p>{rule.detail}</p>
                  <small>{rule.note}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="home-together section-wrap">
        <p className="eyebrow">
          A little from everyone. Something for all of you.
        </p>
        <TaglineReveal />
        <p>
          The best part was never the money. It’s what you make happen together.
        </p>
      </section>
      <section className="section-wrap home-faq">
        <h2>
          Clear before
          <br />
          you chip in.
        </h2>
        <div>
          <details>
            <summary>Can I collect money now?</summary>
            <p>
              The local planner is ready to use. Live payments are not available
              in an unconfigured installation. Test transactions require a
              verified Base Sepolia factory, Builder Code, and configured
              services.
            </p>
          </details>
          <details>
            <summary>Do I need a wallet to plan?</summary>
            <p>
              No. You can preview, save, copy, and download your plan without
              connecting a wallet. Your draft stays on this device unless you
              share it.
            </p>
          </details>
          <details>
            <summary>What happens if we miss the goal?</summary>
            <p>
              It depends on the rule you choose. With a refundable goal, each
              contributor can claim their contribution back after the deadline.
              Crowdfunding rules allow the named wallet to withdraw even if the
              goal is missed. Refunds are not automatic.
            </p>
          </details>
          <details>
            <summary>How do I share a plan with my group?</summary>
            <p>
              Preview your plan, then use Copy plan to paste the terms into your
              group chat, or Download plan to send a file. A planning preview is
              not a published pot or a payment request.
            </p>
          </details>
          <details>
            <summary>What is USDC?</summary>
            <p>
              USDC is the token used for contributions. This version uses test
              USDC on Base Sepolia, a test network. Test tokens have no monetary
              value.
            </p>
          </details>
          <details>
            <summary>Is a private pot hidden from the blockchain?</summary>
            <p>
              No. A private link limits access to the POT page and keeps it out
              of public listings. Addresses, balances, and transactions are
              still publicly visible on Base.
            </p>
          </details>
        </div>
      </section>
      <section className="home-closing section-wrap">
        <p className="eyebrow">You bring the people. Start with a plan.</p>
        <h2>
          That “we should” idea?
          <br />
          <span>Give it a pot.</span>
        </h2>
        <Link className="button button-primary" href="/create">
          Plan your pot <span aria-hidden="true">↗</span>
        </Link>
        <p>No wallet needed to plan. No money moves.</p>
      </section>
      <footer className="site-footer">
        <Brand />
        <p>Good things, pooled.</p>
        <div className="footer-links">
          <Link href="/roadmap">Roadmap</Link>
          <Link href="/connect">Connect wallet</Link>
          <Link href="/dashboard">My pots</Link>
        </div>
        <span className="footer-note">
          Built on Base
        </span>
      </footer>
    </main>
  );
}
