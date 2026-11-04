"use client";

import { useState } from "react";

type Props = {
  name: string;
  address: string;
  isPublic: boolean;
  accessKey: string | null;
};

export function SharePotLink({ name, address, isPublic, accessKey }: Props) {
  const [message, setMessage] = useState("");

  function getSharedUrl(): string {
    return isPublic || !accessKey
      ? `${window.location.origin}/pot/${address}`
      : `${window.location.origin}/pot/${address}#access=${accessKey}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(getSharedUrl());
      setMessage(isPublic ? "Pot link copied." : "Private link copied. Anyone with it can open this pot in POT.");
    } catch {
      setMessage("Copy isn’t available here. Select and copy the pot URL from your browser.");
    }
  }

  async function shareLink() {
    if (typeof navigator === "undefined" || !navigator.share) {
      setMessage("Sharing isn’t available on this device. Copy the pot link instead.");
      return;
    }
    try {
      await navigator.share({
        title: name,
        text: `Take a look at this shared pot: ${name}`,
        url: getSharedUrl(),
      });
      setMessage("Share sheet opened.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setMessage("Couldn’t open sharing on this device. You can copy the pot link instead.");
    }
  }

  return (
    <div className="pot-share-actions" aria-label="Share this pot">
      {(isPublic || accessKey) && (
        <>
          <button className="pot-share-button" type="button" onClick={() => void copyLink()}>
            {isPublic ? "Copy pot link" : "Copy private link"}
          </button>
          <button className="pot-share-button pot-share-button-secondary" type="button" onClick={() => void shareLink()}>
            Share…
          </button>
          {isPublic && (
            <a
              className="pot-share-card-link"
              href={`/pot/${address}/opengraph-image`}
              target="_blank"
              rel="noreferrer"
            >
              Preview share card
            </a>
          )}
        </>
      )}
      <span className="pot-share-feedback" aria-live="polite">{message}</span>
    </div>
  );
}
