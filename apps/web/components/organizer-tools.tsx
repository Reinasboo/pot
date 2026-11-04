"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSignMessage } from "wagmi";
import type { PublicOrganizerPot } from "@/lib/public-pot";

type OrganizerWorkspace = {
  profile: { displayName: string; bio: string; accentColor: string };
  collections: Array<{
    id: string;
    name: string;
    description: string;
    potAddresses: string[];
  }>;
};

type Props = {
  address: string;
  pots: PublicOrganizerPot[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorkspace(value: unknown): value is OrganizerWorkspace {
  return (
    isRecord(value) &&
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
        Array.isArray(collection.potAddresses) &&
        collection.potAddresses.every((potAddress) => typeof potAddress === "string"),
    )
  );
}

export function OrganizerTools({ address, pots }: Props) {
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const [workspace, setWorkspace] = useState<OrganizerWorkspace>();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [accentColor, setAccentColor] = useState("#087a3e");
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadWorkspace() {
      try {
        const response = await fetch(
          `/api/organizer/${encodeURIComponent(address)}/workspace`,
          { cache: "no-store", signal: controller.signal },
        );
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            isRecord(data) && typeof data.error === "string"
              ? data.error
              : "Could not load organizer tools.",
          );
        }
        if (!isWorkspace(data)) throw new Error("Organizer tools returned an invalid response.");
        setWorkspace(data);
        setDisplayName(data.profile.displayName);
        setBio(data.profile.bio);
        setAccentColor(data.profile.accentColor);
        setError("");
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Could not load organizer tools.");
      }
    }
    void loadWorkspace();
    return () => controller.abort();
  }, [address, refreshKey]);

  async function submitAction(
    actionType: string,
    target: string,
    payload: Record<string, string>,
  ) {
    setBusy(true);
    setError("");
    setStatus("");
    const action = { walletAddress: address, actionType, target, payload };
    try {
      const challengeResponse = await fetch("/api/community/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
        cache: "no-store",
      });
      const challenge: unknown = await challengeResponse.json().catch(() => null);
      if (!challengeResponse.ok || !isRecord(challenge) || typeof challenge.message !== "string" || typeof challenge.nonce !== "string") {
        throw new Error(
          isRecord(challenge) && typeof challenge.error === "string"
            ? challenge.error
            : "Could not authorize this organizer change.",
        );
      }
      const signature = await signMessageAsync({ message: challenge.message });
      const response = await fetch("/api/community/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, nonce: challenge.nonce, signature }),
        cache: "no-store",
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "Could not save this organizer change.",
        );
      }
      setStatus("Saved. Your wallet signed this change; no transaction was sent.");
      setRefreshKey((key) => key + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this organizer change.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="organizer-tools" aria-labelledby="organizer-tools-title">
      <div className="organizer-tools-heading">
        <div>
          <p className="pot-eyebrow">YOUR FREE ORGANIZER TOOLS</p>
          <h2 id="organizer-tools-title">Make your pots easier to manage.</h2>
        </div>
        <Link href={`/organizer/${address}`}>View public organizer page <span aria-hidden="true">→</span></Link>
      </div>

      <div className="organizer-tools-grid">
        <form
          className="organizer-tool-card"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAction("organizer_profile", address.toLowerCase(), {
              displayName,
              bio,
              accentColor,
            });
          }}
        >
          <h3>Public profile and page style</h3>
          <p>These details appear on your public organizer page. Your wallet address remains visible as the verified owner.</p>
          <label htmlFor="organizer-display-name">Display name</label>
          <input
            id="organizer-display-name"
            maxLength={60}
            onChange={(event) => setDisplayName(event.target.value)}
            value={displayName}
          />
          <label htmlFor="organizer-bio">Short introduction</label>
          <textarea
            id="organizer-bio"
            maxLength={280}
            onChange={(event) => setBio(event.target.value)}
            rows={3}
            value={bio}
          />
          <label htmlFor="organizer-brand-color">Page accent</label>
          <input
            className="organizer-color-input"
            id="organizer-brand-color"
            onChange={(event) => setAccentColor(event.target.value)}
            type="color"
            value={accentColor}
          />
          <button disabled={busy || isSigning} type="submit">
            {isSigning ? "Confirm in your wallet…" : busy ? "Saving…" : "Sign and save profile"}
          </button>
        </form>

        <div className="organizer-tool-card">
          <h3>Collections</h3>
          <p>Group public pots into lists, such as “Community events” or “This year’s projects.”</p>
          <form
            className="organizer-collection-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitAction("collection_create", address.toLowerCase(), {
                name: collectionName,
                description: collectionDescription,
              });
              setCollectionName("");
              setCollectionDescription("");
            }}
          >
            <label htmlFor="organizer-collection-name">Collection name</label>
            <input
              id="organizer-collection-name"
              maxLength={60}
              onChange={(event) => setCollectionName(event.target.value)}
              value={collectionName}
            />
            <label htmlFor="organizer-collection-description">Description <span>(optional)</span></label>
            <textarea
              id="organizer-collection-description"
              maxLength={280}
              onChange={(event) => setCollectionDescription(event.target.value)}
              rows={2}
              value={collectionDescription}
            />
            <button disabled={busy || isSigning || !collectionName.trim()} type="submit">
              {isSigning ? "Confirm in your wallet…" : busy ? "Saving…" : "Create collection"}
            </button>
          </form>
          {workspace?.collections.length ? (
            <ul className="organizer-collection-list">
              {workspace.collections.map((collection) => (
                <li key={collection.id}>
                  <div className="organizer-collection-title">
                    <span><strong>{collection.name}</strong><small>{collection.description || "No description"}</small></span>
                    <button
                      disabled={busy || isSigning}
                      onClick={() => void submitAction("collection_delete", address.toLowerCase(), {
                        collectionId: collection.id,
                      })}
                      type="button"
                    >Remove</button>
                  </div>
                  {pots.map((pot) => {
                    const checked = collection.potAddresses.some(
                      (potAddress) => potAddress.toLowerCase() === pot.address.toLowerCase(),
                    );
                    return (
                      <label className="organizer-collection-pot" key={pot.address}>
                        <input
                          checked={checked}
                          disabled={busy || isSigning}
                          onChange={() => void submitAction(
                            checked ? "collection_unassign" : "collection_assign",
                            pot.address.toLowerCase(),
                            { collectionId: collection.id, potAddress: pot.address },
                          )}
                          type="checkbox"
                        />
                        <span>{pot.name}</span>
                      </label>
                    );
                  })}
                </li>
              ))}
            </ul>
          ) : workspace ? (
            <p className="organizer-tools-empty">No collections yet. Create one to group your public pots.</p>
          ) : (
            <p className="organizer-tools-empty">Loading collections…</p>
          )}
        </div>
      </div>
      {error && <p className="organizer-tools-error" role="alert">{error}</p>}
      {status && <p className="organizer-tools-status" role="status">{status}</p>}
    </section>
  );
}
