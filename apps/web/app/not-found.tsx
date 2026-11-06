import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="pot-page-shell">
      <SiteHeader />
      <main className="app-state" id="main-content">
        <p>POT · Page not found</p>
        <h1>This link leads to an empty pot.</h1>
        <p>
          The page may have moved, or the address may be incomplete. Check the
          link or start a new plan.
        </p>
        <Link href="/discover">Browse public pots</Link>
      </main>
    </div>
  );
}
