import Link from "next/link";
import { PublicPotPage } from "@/components/public-pot-page";

export const instant = false;

export default async function PotPage({
  params,
}: PageProps<"/pot/[address]">) {
  const { address } = await params;

  return (
    <main className="pot-page-shell">
      <header className="pot-page-header">
        <Link className="brand" href="/" aria-label="POT home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>POT</span>
        </Link>
        <nav className="pot-page-nav" aria-label="Main navigation">
          <Link href="/discover">Discover pots</Link>
          <span className="pot-network-label"><i /> Base Sepolia</span>
        </nav>
      </header>
      <PublicPotPage address={address} />
      <footer className="pot-page-footer">
        <Link className="brand footer-brand" href="/" aria-label="POT home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>POT</span>
        </Link>
        <span>Shared plans, clear rules.</span>
      </footer>
    </main>
  );
}
