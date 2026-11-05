import { Brand } from "@/components/brand";
import Link from "next/link";
import { PublicOrganizerPage } from "@/components/public-organizer-page";
import { pageMetadata } from "@/lib/site-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  return pageMetadata({
    title: "Organizer collections",
    description:
      "Shared goals, brought together. Explore this organizer’s public pots and collections on POT.",
    path: `/organizer/${encodeURIComponent((await params).wallet)}`,
  });
}

export const instant = false;

export default async function OrganizerPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  return (
    <main className="pot-page-shell">
      <header className="pot-page-header">
        <Brand className="brand" href="/" />
        <nav className="pot-page-nav" aria-label="Main navigation">
          <Link href="/discover">Discover pots</Link>
          <span className="pot-network-label">
            <i /> Base Sepolia
          </span>
        </nav>
      </header>
      <PublicOrganizerPage wallet={wallet} />
      <footer className="pot-page-footer">
        <Brand className="brand footer-brand" href="/" />
        <span>Shared plans, clear rules.</span>
      </footer>
    </main>
  );
}
