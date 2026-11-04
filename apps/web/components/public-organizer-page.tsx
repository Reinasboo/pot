"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type OrganizerPageData = {
  walletAddress: string;
  profile: { displayName: string; bio: string; accentColor: string };
  collections: Array<{
    id: string;
    name: string;
    description: string;
    pots: Array<{ address: string; name: string; description: string }>;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOrganizerPageData(value: unknown): value is OrganizerPageData {
  return (
    isRecord(value) &&
    typeof value.walletAddress === "string" &&
    isRecord(value.profile) &&
    typeof value.profile.displayName === "string" &&
    typeof value.profile.bio === "string" &&
    typeof value.profile.accentColor === "string" &&
    Array.isArray(value.collections) &&
    value.collections.every(
      (collection) =>
        isRecord(collection) &&
        typeof collection.id === "string" &&
        typeof collection.name === "string" &&
        typeof collection.description === "string" &&
        Array.isArray(collection.pots) &&
        collection.pots.every(
          (pot) =>
            isRecord(pot) &&
            typeof pot.address === "string" &&
            /^0x[\da-fA-F]{40}$/.test(pot.address) &&
            typeof pot.name === "string" &&
            typeof pot.description === "string",
        ),
    )
  );
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function PublicOrganizerPage({ wallet }: { wallet: string }) {
  const [data, setData] = useState<OrganizerPageData>();
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadProfile() {
      try {
        const response = await fetch(`/api/organizer/${encodeURIComponent(wallet)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "Could not load this organizer’s page.",
          );
        }
        if (!isOrganizerPageData(result)) {
          throw new Error("Organizer page data was returned in an invalid format.");
        }
        setData(result);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Could not load this organizer’s page.");
      }
    }
    void loadProfile();
    return () => controller.abort();
  }, [wallet]);

  return (
    <div className="public-organizer-content">
      {error ? (
        <div className="public-organizer-state" role="alert">
          <h1>We can’t show this organizer page.</h1>
          <p>{error}</p>
        </div>
      ) : !data ? (
        <div className="public-organizer-state" role="status">
          <h1>Loading organizer page…</h1>
          <p>Showing public collections and pots only.</p>
        </div>
      ) : (
        <>
          <header className="public-organizer-heading" style={{ borderColor: data.profile.accentColor }}>
            <p className="pot-eyebrow">POT ORGANIZER · BASE SEPOLIA</p>
            <h1>{data.profile.displayName || "Group fund organizer"}</h1>
            {data.profile.bio && <p>{data.profile.bio}</p>}
            <span>Verified wallet: {shortAddress(data.walletAddress)}</span>
          </header>
          {data.collections.length ? (
            <div className="public-organizer-collections">
              {data.collections.map((collection) => (
                <section key={collection.id} aria-labelledby={`collection-${collection.id}`}>
                  <div>
                    <p className="pot-eyebrow">COLLECTION</p>
                    <h2 id={`collection-${collection.id}`}>{collection.name}</h2>
                    {collection.description && <p>{collection.description}</p>}
                  </div>
                  {collection.pots.length ? (
                    <ul>
                      {collection.pots.map((pot) => (
                        <li key={pot.address}>
                          <Link href={`/pot/${pot.address}`}>
                            <strong>{pot.name}</strong>
                            <span>{pot.description || "Open public pot and review its money rules."}</span>
                            <b>View pot →</b>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="organizer-tools-empty">No public pots in this collection yet.</p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="public-organizer-state">
              <h2>No public collections yet</h2>
              <p>This organizer has not published any collections.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
