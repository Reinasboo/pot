"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { supportedChain } from "@/lib/wagmi";

type Props = {
  address: string;
  organizer: string;
  initialIsPublic: boolean;
  initialAccessKey?: string | null;
  initialDescription: string;
  isPersisted?: boolean;
  onPublished?: (isPublic: boolean, accessKey: string | null) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getResponseData(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function PotMetadataEditor({
  address,
  organizer,
  initialIsPublic,
  initialAccessKey = null,
  initialDescription,
  isPersisted = true,
  onPublished,
}: Props) {
  const { address: walletAddress, chainId, isConnected } = useAccount();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const {
    switchChain,
    isPending: isSwitching,
    error: switchError,
  } = useSwitchChain();
  const [description, setDescription] = useState(initialDescription);
  const [savedDescription, setSavedDescription] = useState(isPersisted ? initialDescription : "");
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [savedIsPublic, setSavedIsPublic] = useState(isPersisted ? initialIsPublic : false);
  const [accessKey, setAccessKey] = useState(initialAccessKey);
  const [savedAccessKey, setSavedAccessKey] = useState(isPersisted ? initialAccessKey : null);
  const [consent, setConsent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [linkFeedback, setLinkFeedback] = useState("");

  if (
    !isConnected ||
    !walletAddress ||
    walletAddress.toLowerCase() !== organizer.toLowerCase()
  ) {
    return null;
  }

  const onSupportedNetwork = chainId === supportedChain.id;
  const descriptionLength = Array.from(description).length;
  const hasChanges =
    description.trim() !== savedDescription.trim() ||
    isPublic !== savedIsPublic ||
    (!isPublic && (!accessKey || accessKey !== savedAccessKey));
  const isPending = isSaving || isSigning;

  function makeAccessKey(): string {
    const bytes = window.crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function hashAccessKey(value: string): Promise<string> {
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function getPrivateLink(value: string): string {
    return `/pot/${address}#access=${value}`;
  }

  async function savePotSettings() {
    if (!walletAddress || !onSupportedNetwork || !consent || !hasChanges) return;

    setError("");
    setStatus("");
    setIsSaving(true);
    try {
      const nextAccessKey = isPublic ? null : accessKey ?? makeAccessKey();
      const accessKeyHash = nextAccessKey ? await hashAccessKey(nextAccessKey) : null;
      setAccessKey(nextAccessKey);
      const challengeResponse = await fetch("/api/pots/metadata/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          potAddress: address,
          description,
          isPublic,
          accessKeyHash,
        }),
        cache: "no-store",
      });
      const challengeData: unknown = await getResponseData(challengeResponse);
      if (!challengeResponse.ok) {
        throw new Error(
          isRecord(challengeData) && typeof challengeData.error === "string"
            ? challengeData.error
            : "Could not authorize this description update.",
        );
      }
      if (
        !isRecord(challengeData) ||
        typeof challengeData.message !== "string" ||
        typeof challengeData.nonce !== "string" ||
        !/^[0-9a-f]{32}$/.test(challengeData.nonce)
      ) {
        throw new Error("The metadata authorization challenge was returned in an invalid format.");
      }

      const signature = await signMessageAsync({ message: challengeData.message });
      const updateResponse = await fetch("/api/pots/metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          potAddress: address,
          nonce: challengeData.nonce,
          signature,
          description,
          isPublic,
          accessKey: nextAccessKey,
        }),
        cache: "no-store",
      });
      const updateData: unknown = await getResponseData(updateResponse);
      if (!updateResponse.ok) {
        throw new Error(
          isRecord(updateData) && typeof updateData.error === "string"
            ? updateData.error
            : "Could not save this pot’s settings.",
        );
      }

      setSavedDescription(description.trim());
      setDescription(description.trim());
      setSavedIsPublic(isPublic);
      setSavedAccessKey(nextAccessKey);
      setConsent(false);
      setStatus(
        isPublic
          ? "Saved. Anyone can find and open this pot."
          : "Saved. Only people with the private link can open this pot in POT.",
      );
      onPublished?.(isPublic, nextAccessKey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this description.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="pot-metadata-editor" aria-labelledby="pot-metadata-editor-title">
      <h2 id="pot-metadata-editor-title">Who can open this pot?</h2>
      <p>
        Choose whether this pot can be found by everyone or opened only with a private link.
        Addresses and transactions remain visible on Base.
      </p>
      {!onSupportedNetwork ? (
        <div className="pot-metadata-editor-network">
          <button
            className="pot-create-preview-button"
            disabled={isSwitching}
            onClick={() => switchChain({ chainId: supportedChain.id })}
            type="button"
          >
            {isSwitching ? "Switching network…" : `Switch to ${supportedChain.name} to edit`}
          </button>
          {switchError && <p className="wallet-error" role="alert">{switchError.message}</p>}
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void savePotSettings();
          }}
        >
          <fieldset className="pot-visibility-options">
            <legend>Pot access</legend>
            <label>
              <input
                checked={isPublic}
                disabled={isPending}
                name={`pot-visibility-${address}`}
                onChange={() => {
                  setIsPublic(true);
                  setAccessKey(null);
                  setError("");
                  setStatus("");
                }}
                type="radio"
              />
              <span><strong>Public</strong> — anyone can find and open it.</span>
            </label>
            <label>
              <input
                checked={!isPublic}
                disabled={isPending}
                name={`pot-visibility-${address}`}
                onChange={() => {
                  setIsPublic(false);
                  setError("");
                  setStatus("");
                }}
                type="radio"
              />
              <span><strong>Private link</strong> — only people with the link can open it in POT.</span>
            </label>
          </fieldset>
          <label htmlFor="pot-public-description">Description <span>(optional)</span></label>
          <textarea
            disabled={isPending}
            id="pot-public-description"
            maxLength={4000}
            onChange={(event) => {
              const nextValue = Array.from(event.target.value).slice(0, 2000).join("");
              setDescription(nextValue);
              setError("");
              setStatus("");
            }}
            rows={4}
            value={description}
          />
          <span className="pot-metadata-editor-count">
            {descriptionLength.toLocaleString()} / 2,000 characters
          </span>
          {!isPublic && accessKey && (
            <div className="pot-private-link-copy">
              <label htmlFor={`private-pot-link-${address}`}>Private link</label>
              <input
                id={`private-pot-link-${address}`}
                readOnly
                value={getPrivateLink(accessKey)}
              />
              {savedAccessKey === accessKey ? (
                <div className="pot-private-link-actions">
                  <button
                    disabled={isPending}
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        new URL(getPrivateLink(accessKey), window.location.origin).toString(),
                      )
                        .then(() => setLinkFeedback("Private link copied. Only share it with people you trust."))
                        .catch(() => setLinkFeedback("Copy isn’t available here. Select and copy the link above."));
                    }}
                    type="button"
                  >
                    Copy private link
                  </button>
                  <a href={getPrivateLink(accessKey)}>Open private pot</a>
                </div>
              ) : (
                <p>This new link becomes active after you sign and save.</p>
              )}
              <button
                disabled={isPending}
                onClick={() => {
                  try {
                    setAccessKey(makeAccessKey());
                    setError("");
                    setStatus("A new link is ready. Save the settings to revoke the old link.");
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : "Could not create a private link.");
                  }
                }}
                type="button"
              >
                Create a new link
              </button>
              <p>Creating a new link revokes the old one after you sign and save.</p>
              {linkFeedback && <p role="status">{linkFeedback}</p>}
            </div>
          )}
          {isPublic && savedIsPublic && (
            <Link className="pot-metadata-open-link" href={`/pot/${address}`}>
              Open pot page
            </Link>
          )}
          <label className="pot-metadata-editor-consent">
            <input
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              disabled={isPending}
              type="checkbox"
            />
            <span>
              {isPublic
                ? "I understand anyone can find this pot and read its description."
                : "I understand anyone with this link can open and share this pot in POT."}
            </span>
          </label>
          <button
            className="pot-create-preview-button"
            disabled={isPending || !consent || !hasChanges}
            type="submit"
          >
            {isSigning
              ? "Confirm the message in your wallet…"
              : isSaving
                ? "Saving pot access…"
                : isPublic
                  ? "Sign and make pot public"
                  : "Sign and save private link"}
          </button>
        </form>
      )}
      {error && <p className="pot-metadata-editor-error" role="alert">{error}</p>}
      {status && <p className="pot-metadata-editor-status" role="status">{status}</p>}
    </section>
  );
}
