import { pageMetadata } from "@/lib/site-metadata";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { PotDiscovery } from "@/components/pot-discovery";

export const metadata = pageMetadata({
  title: "Discover public pots",
  description:
    "Browse public group funds and review their money rules before contributing.",
  path: "/discover",
});

export default function DiscoverPage() {
  return (
    <main className="pot-page-shell">
      <header className="pot-page-header">
        <Brand className="brand" href="/" />
        <nav className="pot-page-nav" aria-label="Main navigation">
          <Link href="/dashboard">My pots</Link>
        </nav>
      </header>
      <PotDiscovery />
      <footer className="pot-page-footer">
        <Brand className="brand footer-brand" href="/" />
        <span>
          Public listing does not mean a pot has been audited or endorsed.
        </span>
      </footer>
    </main>
  );
}
