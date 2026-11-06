import { Brand } from "@/components/brand";
import Link from "next/link";
import { PublicPotPage } from "@/components/public-pot-page";
import { getPotPageMetadata } from "@/lib/pot-social";

export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/pot/[address]">) {
  return getPotPageMetadata((await params).address);
}

export default async function PotPage({ params }: PageProps<"/pot/[address]">) {
  const { address } = await params;

  return (
    <main className="pot-page-shell">
      <header className="pot-page-header">
        <Brand className="brand" href="/" />
        <nav className="pot-page-nav" aria-label="Main navigation">
          <Link href="/discover">Discover pots</Link>
        </nav>
      </header>
      <PublicPotPage address={address} />
      <footer className="pot-page-footer">
        <Brand className="brand footer-brand" href="/" />
        <span>Shared plans, clear rules.</span>
      </footer>
    </main>
  );
}
