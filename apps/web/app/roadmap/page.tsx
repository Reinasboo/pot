import type { Metadata } from "next";
import Link from "next/link";
import { RoadmapSection } from "@/components/roadmap-section";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "See which POT features work today, what is unavailable, and what is only planned.",
};

export default function RoadmapPage() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="POT home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>POT</span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/discover">Discover pots</Link>
          <Link href="/dashboard">My pots</Link>
        </nav>
        <div className="site-header-actions">
          <Link className="header-link" href="/create">Plan a pot</Link>
        </div>
      </header>
      <RoadmapSection standalone />
      <footer className="site-footer">
        <Link className="brand footer-brand" href="/" aria-label="POT home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>POT</span>
        </Link>
        <p>Money moves better together.</p>
        <div className="footer-links">
          <Link href="/">Home</Link>
          <Link href="/create">Plan a pot</Link>
        </div>
        <span className="footer-note">Planned stages are not claims of live functionality.</span>
      </footer>
    </main>
  );
}
