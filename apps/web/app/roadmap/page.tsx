import { pageMetadata } from "@/lib/site-metadata";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { RoadmapSection } from "@/components/roadmap-section";

export const metadata = pageMetadata({
  title: "Roadmap",
  description:
    "See which POT features work today, what is unavailable, and what is only planned.",
  path: "/roadmap",
});

export default function RoadmapPage() {
  return (
    <main>
      <header className="site-header">
        <Brand className="brand" href="/" />
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/discover">Discover pots</Link>
          <Link href="/dashboard">My pots</Link>
        </nav>
        <div className="site-header-actions">
          <Link className="header-link" href="/create">
            Plan a pot
          </Link>
        </div>
      </header>
      <RoadmapSection standalone />
      <footer className="site-footer">
        <Brand className="brand footer-brand" href="/" />
        <p>Money moves better together.</p>
        <div className="footer-links">
          <Link href="/">Home</Link>
          <Link href="/create">Plan a pot</Link>
        </div>
        <span className="footer-note">
          Planned stages are not claims of live functionality.
        </span>
      </footer>
    </main>
  );
}
