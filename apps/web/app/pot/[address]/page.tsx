import { Brand } from "@/components/brand";
import { PublicPotPage } from "@/components/public-pot-page";
import { getPotPageMetadata } from "@/lib/pot-social";
import { SiteHeader } from "@/components/site-header";

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
      <SiteHeader activeSection="discover" />
      <PublicPotPage address={address} />
      <footer className="pot-page-footer">
        <Brand className="brand footer-brand" href="/" />
        <span>Shared plans, clear rules.</span>
      </footer>
    </main>
  );
}
