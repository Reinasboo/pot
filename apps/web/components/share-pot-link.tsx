"use client";

import { useState } from "react";

type Props = {
  name: string;
};

export function SharePotLink({ name }: Props) {
  const [message, setMessage] = useState("");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Pot link copied.");
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
        url: window.location.href,
      });
      setMessage("Share sheet opened.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setMessage("Couldn’t open sharing on this device. You can copy the pot link instead.");
    }
  }

  return (
    <div className="pot-share-actions" aria-label="Share this pot">
      <button className="pot-share-button" type="button" onClick={() => void copyLink()}>
        Copy pot link
      </button>
      <button className="pot-share-button pot-share-button-secondary" type="button" onClick={() => void shareLink()}>
        Share…
      </button>
      <span className="pot-share-feedback" aria-live="polite">{message}</span>
    </div>
  );
}
