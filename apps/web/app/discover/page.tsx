import type { Metadata } from "next";
import Link from "next/link";
import { PotDiscovery } from "@/components/pot-discovery";

export const metadata: Metadata = {
  title: "Discover public pots | POT",
  description: "Browse public group funds and review their money rules before contributing.",
};

export default function DiscoverPage() {
  return (
    <main className="pot-page-shell">
      <header className="pot-page-header">
        <Link className="brand" href="/" aria-label="POT home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>POT</span>
        </Link>
        <nav className="pot-page-nav" aria-label="Main navigation">
          <Link href="/dashboard">My pots</Link>
          <span className="pot-network-label"><i /> Base Sepolia</span>
        </nav>
      </header>
      <PotDiscovery />
      <footer className="pot-page-footer">
        <Link className="brand footer-brand" href="/" aria-label="POT home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>POT</span>
        </Link>
        <span>Public listing does not mean a pot has been audited or endorsed.</span>
      </footer>
    </main>
  );
}
