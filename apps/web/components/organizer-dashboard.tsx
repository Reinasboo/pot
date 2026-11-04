"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useSwitchChain } from "wagmi";
import { WalletConnection } from "@/components/wallet-connection";
import {
  formatTokenAmount,
  type PublicOrganizerPot,
  type PublicParticipatedPot,
} from "@/lib/public-pot";
import { supportedChain } from "@/lib/wagmi";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOrganizerPots(value: unknown): value is PublicOrganizerPot[] {
  return (
    Array.isArray(value) &&
    value.every(
      (pot) =>
        isRecord(pot) &&
        typeof pot.address === "string" &&
        /^0x[\da-fA-F]{40}$/.test(pot.address) &&
        typeof pot.name === "string" &&
        typeof pot.targetBased === "boolean" &&
        typeof pot.createdBlock === "string" &&
        /^\d+$/.test(pot.createdBlock) &&
        typeof pot.escrowBalance === "string" &&
        /^\d+$/.test(pot.escrowBalance),
    )
  );
}

function isParticipatedPots(value: unknown): value is PublicParticipatedPot[] {
  return (
    Array.isArray(value) &&
    value.every(
      (pot) =>
        isRecord(pot) &&
        typeof pot.address === "string" &&
        /^0x[\da-fA-F]{40}$/.test(pot.address) &&
        typeof pot.name === "string" &&
        typeof pot.targetBased === "boolean" &&
        typeof pot.createdBlock === "string" &&
        /^\d+$/.test(pot.createdBlock) &&
        typeof pot.lastContributionBlock === "string" &&
        /^\d+$/.test(pot.lastContributionBlock) &&
        typeof pot.contributedAmount === "string" &&
        /^\d+$/.test(pot.contributedAmount) &&
        typeof pot.escrowBalance === "string" &&
        /^\d+$/.test(pot.escrowBalance),
    )
  );
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatUsdc(amount: string): string {
  const [whole, fraction = ""] = formatTokenAmount(amount, 6).split(".");
  const groupedWhole = BigInt(whole).toLocaleString();
  const visibleFraction = fraction.replace(/0+$/, "");
  return `${visibleFraction ? `${groupedWhole}.${visibleFraction}` : groupedWhole} USDC`;
}

async function fetchOrganizerPots(
  address: string,
  signal: AbortSignal,
): Promise<PublicOrganizerPot[]> {
  const response = await fetch(
    `/api/pots?organizer=${encodeURIComponent(address)}`,
    { cache: "no-store", signal },
  );
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : "Could not load pots for this wallet.";
    throw new Error(message);
  }
  if (!isOrganizerPots(data)) {
    throw new Error("Pot data was returned in an invalid format.");
  }
  return data;
}

async function fetchParticipatedPots(
  address: string,
  signal: AbortSignal,
): Promise<PublicParticipatedPot[]> {
  const response = await fetch(
    `/api/pots/participating?contributor=${encodeURIComponent(address)}`,
    { cache: "no-store", signal },
  );
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : "Could not load pots for this wallet.";
    throw new Error(message);
  }
  if (!isParticipatedPots(data)) {
    throw new Error("Contribution data was returned in an invalid format.");
  }
  return data;
}

export function OrganizerDashboard() {
  const { address, chainId, isConnected } = useAccount();
  const {
    switchChain,
    isPending: isSwitching,
    error: switchError,
    reset: resetSwitch,
  } = useSwitchChain();
  const onSupportedNetwork = isConnected && chainId === supportedChain.id;
  const {
    data: pots,
    error,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["organizer-pots", address],
    queryFn: ({ signal }) => {
      if (!address) throw new Error("Connect a wallet to view your pots.");
      return fetchOrganizerPots(address, signal);
    },
    enabled: Boolean(address) && onSupportedNetwork,
    retry: false,
  });

  const {
    data: participatedPots,
    error: participatedError,
    isError: isParticipatedError,
    isLoading: isParticipatedLoading,
    refetch: refetchParticipated,
  } = useQuery({
    queryKey: ["participated-pots", address],
    queryFn: ({ signal }) => {
      if (!address) throw new Error("Connect a wallet to view your contributions.");
      return fetchParticipatedPots(address, signal);
    },
    enabled: Boolean(address) && onSupportedNetwork,
    retry: false,
  });
  const totalEscrow = pots?.reduce(
    (total, pot) => total + BigInt(pot.escrowBalance),
    BigInt(0),
  );
  const totalWalletContributions = participatedPots?.reduce(
    (total, pot) => total + BigInt(pot.contributedAmount),
    BigInt(0),
  );

  if (!isConnected || !address) {
    return (
      <div className="organizer-dashboard-content">
        <div className="organizer-dashboard-intro">
          <p className="pot-eyebrow">ORGANIZER SPACE</p>
          <h1>Your pots, in one place.</h1>
          <p>Connect your wallet to view public pots you created or contributed to.</p>
        </div>
        <WalletConnection />
      </div>
    );
  }

  return (
    <div className="organizer-dashboard-content">
      <div className="organizer-dashboard-intro">
        <p className="pot-eyebrow">ORGANIZER SPACE</p>
        <h1>Your pots, in one place.</h1>
        <p>
          Showing public pots associated with <strong title={address}>{shortAddress(address)}</strong>.
          Each list shows up to 25 indexed public pots; participation search considers the 250 latest
          indexed contribution events. Private pots and events not yet indexed are not shown.
          Financial state on each pot page is read directly from chain.
        </p>
        <Link className="organizer-plan-link" href="/create">Plan a pot <span aria-hidden="true">→</span></Link>
      </div>

      {onSupportedNetwork &&
        !isLoading &&
        !isError &&
        !isParticipatedLoading &&
        !isParticipatedError && (
          <section className="organizer-dashboard-totals" aria-label="Verified dashboard totals">
            <article>
              <span>Held in public pots you created</span>
              <strong>{formatUsdc(totalEscrow?.toString() ?? "0")}</strong>
              <small>Current USDC balances read from Base Sepolia.</small>
            </article>
            <article>
              <span>Gross contributions to listed public pots</span>
              <strong>{formatUsdc(totalWalletContributions?.toString() ?? "0")}</strong>
              <small>
                Refunded amounts are not deducted. Excludes undiscovered, private, or unindexed
                pots.
              </small>
            </article>
          </section>
        )}

      {!onSupportedNetwork ? (
        <section className="organizer-dashboard-notice" role="status">
          <h2>Switch to Base Sepolia</h2>
          <p>Pot records are indexed on Base Sepolia. Switch networks to view this wallet’s pots.</p>
          <button
            className="wallet-action wallet-action-primary"
            disabled={isSwitching}
            onClick={() => {
              resetSwitch();
              switchChain({ chainId: supportedChain.id });
            }}
            type="button"
          >
            {isSwitching ? "Switching network…" : "Switch network"}
          </button>
          {switchError && <p className="wallet-error" role="alert">{switchError.message}</p>}
        </section>
      ) : (
        <section className="organizer-pot-list" aria-labelledby="organizer-pot-list-title">
          <div className="organizer-pot-list-heading">
            <h2 id="organizer-pot-list-title">Pots you created</h2>
            <span>Base Sepolia</span>
          </div>

          {isLoading ? (
            <div className="organizer-list-state" role="status" aria-live="polite">
              <span className="pot-state-indicator" />
              <p>Loading indexed pots…</p>
            </div>
          ) : isError ? (
            <div className="organizer-list-state organizer-list-error" role="alert">
              <p>{error instanceof Error ? error.message : "Could not load pots for this wallet."}</p>
              <button type="button" onClick={() => void refetch()}>
                Try again
              </button>
            </div>
          ) : !pots?.length ? (
            <div className="organizer-list-state organizer-list-empty">
              <span className="pot-empty-mark" aria-hidden="true">—</span>
              <div>
                <h3>No public pots indexed for this wallet</h3>
                <p>
                  Public pots created by this wallet appear after their creation events are indexed.
                </p>
              </div>
            </div>
          ) : (
            <ol className="organizer-pot-cards">
              {pots.map((pot) => (
                <li key={pot.address}>
                  <Link href={`/pot/${pot.address}`}>
                    <span className="organizer-pot-card-copy">
                      <strong>{pot.name}</strong>
                      <span>
                        {pot.targetBased ? "Goal-based pot" : "Flexible pot"} · Created at block{" "}
                        {BigInt(pot.createdBlock).toLocaleString()} ·{" "}
                        {formatUsdc(pot.escrowBalance)} currently held
                      </span>
                    </span>
                    <span className="organizer-pot-card-action" aria-hidden="true">Open →</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {onSupportedNetwork && (
        <section
          className="organizer-pot-list organizer-participated-pot-list"
          aria-labelledby="participated-pot-list-title"
        >
          <div className="organizer-pot-list-heading">
            <h2 id="participated-pot-list-title">Pots you’ve contributed to</h2>
            <span>Base Sepolia</span>
          </div>

          {isParticipatedLoading ? (
            <div className="organizer-list-state" role="status" aria-live="polite">
              <span className="pot-state-indicator" />
              <p>Loading indexed contributions…</p>
            </div>
          ) : isParticipatedError ? (
            <div className="organizer-list-state organizer-list-error" role="alert">
              <p>
                {participatedError instanceof Error
                  ? participatedError.message
                  : "Could not load contributions for this wallet."}
              </p>
              <button type="button" onClick={() => void refetchParticipated()}>
                Try again
              </button>
            </div>
          ) : !participatedPots?.length ? (
            <div className="organizer-list-state organizer-list-empty">
              <span className="pot-empty-mark" aria-hidden="true">—</span>
              <div>
                <h3>No confirmed public contributions indexed</h3>
                <p>
                  Pots you contribute to will appear after the confirmed contribution events are
                  indexed.
                </p>
              </div>
            </div>
          ) : (
            <ol className="organizer-pot-cards">
              {participatedPots.map((pot) => (
                <li key={pot.address}>
                  <Link href={`/pot/${pot.address}`}>
                    <span className="organizer-pot-card-copy">
                      <strong>{pot.name}</strong>
                      <span>
                        {pot.targetBased ? "Goal-based pot" : "Flexible pot"} · Last indexed
                        contribution at block {BigInt(pot.lastContributionBlock).toLocaleString()}
                        · {formatUsdc(pot.contributedAmount)} gross contributed ·{" "}
                        {formatUsdc(pot.escrowBalance)} currently held
                      </span>
                    </span>
                    <span className="organizer-pot-card-action" aria-hidden="true">Open →</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <div className="organizer-dashboard-account">
        <span>Wallet connected</span>
        <Link href="/connect">Manage connection</Link>
      </div>
    </div>
  );
}
