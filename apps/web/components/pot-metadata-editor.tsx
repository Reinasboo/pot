"use client";

import { useState } from "react";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { supportedChain } from "@/lib/wagmi";

type Props = {
  address: string;
  organizer: string;
  isPublic: boolean;
  initialDescription: string;
  onPublished?: () => void;
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
  isPublic,
  initialDescription,
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
  const [savedDescription, setSavedDescription] = useState(initialDescription);
  const [consent, setConsent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  if (
    !isPublic ||
    !isConnected ||
    !walletAddress ||
    walletAddress.toLowerCase() !== organizer.toLowerCase()
  ) {
    return null;
  }

  const onSupportedNetwork = chainId === supportedChain.id;
  const descriptionLength = Array.from(description).length;
  const hasChanges = description.trim() !== savedDescription.trim();
  const isPending = isSaving || isSigning;

  async function publishDescription() {
    if (!walletAddress || !onSupportedNetwork || !consent || !hasChanges) return;

    setError("");
    setStatus("");
    setIsSaving(true);
    try {
      const challengeResponse = await fetch("/api/pots/metadata/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          potAddress: address,
          description,
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
        }),
        cache: "no-store",
      });
      const updateData: unknown = await getResponseData(updateResponse);
      if (!updateResponse.ok) {
        throw new Error(
          isRecord(updateData) && typeof updateData.error === "string"
            ? updateData.error
            : "Could not save this pot’s public description.",
        );
      }

      setSavedDescription(description.trim());
      setDescription(description.trim());
      setConsent(false);
      setStatus("Public description saved.");
      onPublished?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this description.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="pot-metadata-editor" aria-labelledby="pot-metadata-editor-title">
      <h2 id="pot-metadata-editor-title">Public description</h2>
      <p>
        Only this pot’s organizer can update this description. Saving requires a wallet signature,
        not a transaction. The text will be visible to anyone visiting this public pot.
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
            void publishDescription();
          }}
        >
          <label htmlFor="pot-public-description">Description</label>
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
          <label className="pot-metadata-editor-consent">
            <input
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              disabled={isPending}
              type="checkbox"
            />
            <span>I understand this description will be public.</span>
          </label>
          <button
            className="pot-create-preview-button"
            disabled={isPending || !consent || !hasChanges}
            type="submit"
          >
            {isSigning
              ? "Confirm the message in your wallet…"
              : isSaving
                ? "Saving public description…"
                : "Sign and publish description"}
          </button>
        </form>
      )}
      {error && <p className="pot-metadata-editor-error" role="alert">{error}</p>}
      {status && <p className="pot-metadata-editor-status" role="status">{status}</p>}
    </section>
  );
}
