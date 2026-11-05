import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-state" id="main-content">
      <p>POT · Page not found</p>
      <h1>This link leads to an empty pot.</h1>
      <p>
        The page may have moved, or the address may be incomplete. Check the
        link or start a new plan.
      </p>
      <Link href="/">Back to POT</Link>
    </main>
  );
}
