"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { formatDisplayAmount } from "@/lib/format-amount";
import { supportedChain } from "@/lib/wagmi";

type Reaction = "heart" | "celebrate" | "support";
type CommunityData = {
  updates: Array<{
    id: string;
    organizer: string;
    body: string;
    createdAt: string;
  }>;
  reactions: Record<Reaction, number>;
  myReaction: Reaction | null;
};

const reactionOptions: Array<{
  value: Reaction;
  label: string;
  symbol: string;
}> = [
  { value: "heart", label: "Like", symbol: "♥" },
  { value: "celebrate", label: "Celebrate", symbol: "✦" },
  { value: "support", label: "Support", symbol: "＋" },
];

type Props = {
  address: string;
  organizer: string;
  totalContributed: string;
  targetAmount: string;
  tokenDecimals: number;
  tokenSymbol: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReaction(value: unknown): value is Reaction {
  return value === "heart" || value === "celebrate" || value === "support";
}

function isCommunityData(value: unknown): value is CommunityData {
  const reactions = isRecord(value) ? value.reactions : null;
  return (
    isRecord(value) &&
    Array.isArray(value.updates) &&
    value.updates.every(
      (update) =>
        isRecord(update) &&
        typeof update.id === "string" &&
        typeof update.organizer === "string" &&
        typeof update.body === "string" &&
        typeof update.createdAt === "string",
    ) &&
    isRecord(reactions) &&
    ["heart", "celebrate", "support"].every(
      (reaction) =>
        typeof reactions[reaction] === "number" &&
        Number.isSafeInteger(reactions[reaction]) &&
        reactions[reaction] >= 0,
    ) &&
    (value.myReaction === null || isReaction(value.myReaction))
  );
}

function formatAmount(
  amount: string,
  decimals: number,
  symbol: string,
): string {
  return formatDisplayAmount(amount, decimals, symbol);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    : "Date unavailable";
}

export function PotCommunityPanel({
  address,
  organizer,
  totalContributed,
  targetAmount,
  tokenDecimals,
  tokenSymbol,
}: Props) {
  const { address: walletAddress, chainId, isConnected } = useAccount();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [community, setCommunity] = useState<CommunityData>();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const goal = BigInt(targetAmount);
  const raised = BigInt(totalContributed);
  const progress = goal > BigInt(0) ? Number((raised * BigInt(100)) / goal) : 0;
  const reachedMilestones = [25, 50, 75, 100].filter(
    (milestone) => progress >= milestone,
  );
  const isOrganizer = Boolean(
    walletAddress && walletAddress.toLowerCase() === organizer.toLowerCase(),
  );
  const onSupportedNetwork = chainId === supportedChain.id;

  useEffect(() => {
    const controller = new AbortController();
    async function loadCommunity() {
      try {
        const search = new URLSearchParams();
        if (walletAddress) search.set("wallet", walletAddress);
        const response = await fetch(
          `/api/pots/${encodeURIComponent(address)}/community?${search.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "Could not load this pot’s community activity.",
          );
        }
        if (!isCommunityData(result)) {
          throw new Error(
            "Community activity was returned in an invalid format.",
          );
        }
        setCommunity(result);
        setError("");
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load community activity.",
        );
      }
    }
    void loadCommunity();
    return () => controller.abort();
  }, [address, walletAddress, refreshKey]);

  async function submitAction(
    actionType: "pot_update" | "pot_reaction",
    payload: Record<string, string>,
  ) {
    if (!walletAddress || !onSupportedNetwork) {
      setError("Connect your wallet on Base Sepolia to continue.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const action = { walletAddress, actionType, target: address, payload };
    try {
      const challengeResponse = await fetch("/api/community/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
        cache: "no-store",
      });
      const challenge: unknown = await challengeResponse
        .json()
        .catch(() => null);
      if (
        !challengeResponse.ok ||
        !isRecord(challenge) ||
        typeof challenge.message !== "string" ||
        typeof challenge.nonce !== "string"
      ) {
        throw new Error(
          isRecord(challenge) && typeof challenge.error === "string"
            ? challenge.error
            : "Could not authorize this action.",
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
            : "Could not save this action.",
        );
      }
      if (actionType === "pot_update") setBody("");
      setMessage(
        "Saved. Your signature did not send a payment or transaction.",
      );
      setRefreshKey((key) => key + 1);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="pot-community-panel"
      aria-labelledby="pot-community-title"
    >
      <div className="pot-community-heading">
        <div>
          <p className="pot-eyebrow">KEEP EVERYONE IN THE LOOP</p>
          <h2 id="pot-community-title">Updates and support</h2>
        </div>
        <span>Wallet signature only · no payment</span>
      </div>

      {goal > BigInt(0) && (
        <div className="pot-milestones" aria-label="Funding goal milestones">
          <strong>Goal progress</strong>
          <span>
            {formatAmount(totalContributed, tokenDecimals, tokenSymbol)} of{" "}
            {formatAmount(targetAmount, tokenDecimals, tokenSymbol)}
          </span>
          <div className="pot-milestone-track" aria-hidden="true">
            <span style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          {reachedMilestones.length ? (
            <p>
              Milestones reached:{" "}
              {reachedMilestones.map((value) => `${value}%`).join(" · ")}
            </p>
          ) : (
            <p>
              The first milestone appears when confirmed contributions reach 25%
              of the goal.
            </p>
          )}
        </div>
      )}

      <div className="pot-reactions" aria-label="Show your support">
        {reactionOptions.map((option) => (
          <button
            aria-pressed={community?.myReaction === option.value}
            className={
              community?.myReaction === option.value ? "is-selected" : ""
            }
            disabled={busy || isSigning || !isConnected || !onSupportedNetwork}
            key={option.value}
            onClick={() =>
              void submitAction("pot_reaction", { reaction: option.value })
            }
            type="button"
          >
            <span aria-hidden="true">{option.symbol}</span>
            {option.label}
            <b>{community?.reactions[option.value] ?? 0}</b>
          </button>
        ))}
        {!isConnected && <Link href="/connect">Connect to react</Link>}
        {isConnected && !onSupportedNetwork && (
          <button
            disabled={isSwitching}
            onClick={() => switchChain({ chainId: supportedChain.id })}
            type="button"
          >
            {isSwitching ? "Switching…" : "Switch to Base Sepolia"}
          </button>
        )}
      </div>

      {isOrganizer && (
        <form
          className="pot-update-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAction("pot_update", { body });
          }}
        >
          <label htmlFor="pot-community-update">
            Post an update for contributors
          </label>
          <textarea
            id="pot-community-update"
            maxLength={500}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Share a brief update about the plan."
            value={body}
          />
          <div>
            <span>{Array.from(body).length} / 500</span>
            <button
              disabled={
                busy || isSigning || !body.trim() || !onSupportedNetwork
              }
              type="submit"
            >
              {isSigning
                ? "Confirm in your wallet…"
                : busy
                  ? "Saving…"
                  : "Sign and post"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="pot-community-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="pot-community-message" role="status">
          {message}
        </p>
      )}

      {community?.updates.length ? (
        <ol className="pot-update-list">
          {community.updates.map((update) => (
            <li key={update.id}>
              <span className="pot-update-mark" aria-hidden="true">
                ↗
              </span>
              <div>
                <p>{update.body}</p>
                <time>{formatDate(update.createdAt)}</time>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="pot-community-empty">
          {community
            ? "No organizer updates yet. Confirmed contributions and withdrawals appear in the on-chain activity below."
            : "Loading community activity…"}
        </p>
      )}
    </section>
  );
}
