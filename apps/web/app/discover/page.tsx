import { pageMetadata } from "@/lib/site-metadata";
import { Brand } from "@/components/brand";
import { PotDiscovery } from "@/components/pot-discovery";
import { SiteHeader } from "@/components/site-header";

export const metadata = pageMetadata({
  title: "Discover public pots",
  description:
    "Browse public group funds and review their money rules before contributing.",
  path: "/discover",
});

export default function DiscoverPage() {
  return (
    <main className="pot-page-shell">
      <SiteHeader activeSection="discover" />
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
