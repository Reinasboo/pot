import { pageMetadata } from "@/lib/site-metadata";
import { Brand } from "@/components/brand";
import { OrganizerDashboard } from "@/components/organizer-dashboard";
import { SiteHeader } from "@/components/site-header";

export const metadata = pageMetadata({
  title: "My pots",
  description: "See public pots you created or contributed to on Base Sepolia.",
  path: "/dashboard",
  index: false,
});

export default function DashboardPage() {
  return (
    <main className="pot-page-shell">
      <SiteHeader activeSection="dashboard" />
      <OrganizerDashboard />
      <footer className="pot-page-footer">
        <Brand className="brand footer-brand" href="/" />
        <span>Shared plans, clear rules.</span>
      </footer>
    </main>
  );
}
