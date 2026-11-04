import type { Metadata } from "next";
import Link from "next/link";
import { PublicOrganizerPage } from "@/components/public-organizer-page";

export const metadata: Metadata = {
  title: "Organizer | POT",
  description: "See public group funds and collections from a POT organizer.",
};

export const instant = false;

export default async function OrganizerPage({
  params,
}: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  return (
    <main className="pot-page-shell">
      <header className="pot-page-header">
        <Link className="brand" href="/" aria-label="POT home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>POT</span>
        </Link>
        <nav className="pot-page-nav" aria-label="Main navigation">
          <Link href="/discover">Discover pots</Link>
          <span className="pot-network-label"><i /> Base Sepolia</span>
        </nav>
      </header>
      <PublicOrganizerPage wallet={wallet} />
      <footer className="pot-page-footer">
        <Link className="brand footer-brand" href="/" aria-label="POT home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>POT</span>
        </Link>
        <span>Shared plans, clear rules.</span>
      </footer>
    </main>
  );
}
