import { pageMetadata } from "@/lib/site-metadata";
import { Brand } from "@/components/brand";
import { Suspense } from "react";
import { PotPlanner } from "@/components/pot-planner";
import { SiteHeader } from "@/components/site-header";

export const metadata = pageMetadata({
  title: "Plan a pot",
  description: "Preview clear funding and settlement rules for a shared pot.",
  path: "/create",
});

export default function CreatePage() {
  return (
    <main className="pot-page-shell">
      <SiteHeader activeSection="plan" />
      <Suspense
        fallback={
          <div className="app-state" role="status">
            Opening your planner…
          </div>
        }
      >
        <PotPlanner />
      </Suspense>
      <footer className="pot-page-footer">
        <Brand className="brand footer-brand" href="/" />
        <span>Shared plans, clear rules.</span>
      </footer>
    </main>
  );
}
