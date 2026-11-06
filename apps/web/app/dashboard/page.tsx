import { pageMetadata } from "@/lib/site-metadata";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { OrganizerDashboard } from "@/components/organizer-dashboard";

export const metadata = pageMetadata({
  title: "My pots",
  description: "See public pots you created or contributed to on Base Sepolia.",
  path: "/dashboard",
  index: false,
});

export default function DashboardPage() {
  return (
    <main className="pot-page-shell">
      <header className="pot-page-header">
        <Brand className="brand" href="/" />
        <nav className="pot-page-nav" aria-label="Main navigation">
          <Link href="/discover">Discover pots</Link>
        </nav>
      </header>
      <OrganizerDashboard />
      <footer className="pot-page-footer">
        <Brand className="brand footer-brand" href="/" />
        <span>Shared plans, clear rules.</span>
      </footer>
    </main>
  );
}
