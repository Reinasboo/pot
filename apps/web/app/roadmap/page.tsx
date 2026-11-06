import { pageMetadata } from "@/lib/site-metadata";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { RoadmapSection } from "@/components/roadmap-section";
import { SiteHeader } from "@/components/site-header";

export const metadata = pageMetadata({
  title: "Roadmap",
  description:
    "See which POT features work today, what is unavailable, and what is only planned.",
  path: "/roadmap",
});

export default function RoadmapPage() {
  return (
    <main>
      <SiteHeader activeSection="roadmap" />
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
