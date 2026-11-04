import Link from "next/link";
import { PotCreationDraft } from "@/components/pot-creation-draft";

export const metadata = {
  title: "Plan a pot",
  description: "Preview clear funding and settlement rules for a shared pot.",
};

export default function CreatePage() {
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
        <Link className="pot-create-back-link" href="/dashboard">My pots</Link>
      </header>
      <PotCreationDraft />
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
