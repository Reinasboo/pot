"use client";

import Link from "next/link";

export default function ErrorPage({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main className="app-state" id="main-content">
      <p>POT · Something went wrong</p>
      <h2>We couldn’t open this page.</h2>
      <p>
        Try loading it again. If you submitted a transaction, check your wallet
        or the explorer before submitting another.
      </p>
      <button type="button" onClick={retry}>
        Try again
      </button>
      <Link href="/">Back to POT</Link>
    </main>
  );
}
