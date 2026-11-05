"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useSwitchChain } from "wagmi";
import { WalletConnection } from "@/components/wallet-connection";
import { OrganizerTools } from "@/components/organizer-tools";
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
        typeof pot.fundingMode === "number" &&
        Number.isInteger(pot.fundingMode) &&
        pot.fundingMode >= 0 &&
        pot.fundingMode <= 3 &&
        typeof pot.targetBased === "boolean" &&
        typeof pot.createdBlock === "string" &&
        /^\d+$/.test(pot.createdBlock) &&
        typeof pot.escrowBalance === "string" &&
        /^\d+$/.test(pot.escrowBalance) &&
        typeof pot.totalContributed === "string" &&
        /^\d+$/.test(pot.totalContributed) &&
        typeof pot.contributionOpen === "boolean" &&
        typeof pot.paidOut === "boolean",
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
        typeof pot.fundingMode === "number" &&
        Number.isInteger(pot.fundingMode) &&
        pot.fundingMode >= 0 &&
        pot.fundingMode <= 3 &&
        typeof pot.targetBased === "boolean" &&
        typeof pot.createdBlock === "string" &&
        /^\d+$/.test(pot.createdBlock) &&
        typeof pot.lastContributionBlock === "string" &&
        /^\d+$/.test(pot.lastContributionBlock) &&
        typeof pot.contributedAmount === "string" &&
        /^\d+$/.test(pot.contributedAmount) &&
        typeof pot.escrowBalance === "string" &&
        /^\d+$/.test(pot.escrowBalance) &&
        typeof pot.totalContributed === "string" &&
        /^\d+$/.test(pot.totalContributed) &&
        typeof pot.contributionOpen === "boolean" &&
        typeof pot.paidOut === "boolean",
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

function fundingRuleLabel(fundingMode: number): string {
  if (fundingMode === 0) return "Goal + refunds";
  if (fundingMode === 1) return "Organizer decides";
  if (fundingMode === 2) return "Crowdfunding · payout after deadline";
  return "Crowdfunding · early withdrawals";
}

function downloadPotReport(pots: PublicOrganizerPot[]) {
  const rows = [
    [
      "Pot name",
      "Address",
      "Rule",
      "Total contributed (USDC)",
      "Current balance (USDC)",
      "Status",
      "Public link",
    ],
    ...pots.map((pot) => [
      pot.name,
      pot.address,
      fundingRuleLabel(pot.fundingMode),
      formatTokenAmount(pot.totalContributed, 6),
      formatTokenAmount(pot.escrowBalance, 6),
      pot.paidOut
        ? "Paid out"
        : pot.contributionOpen
          ? "Accepting contributions"
          : "Closed",
      `${window.location.origin}/pot/${pot.address}`,
    ]),
  ];
  const csv = rows
    .map((row) =>
      row.map((field) => `"${field.replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "pot-organizer-report.csv";
  anchor.click();
  URL.revokeObjectURL(url);
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
      if (!address)
        throw new Error("Connect a wallet to view your contributions.");
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
  const totalRaised = pots?.reduce(
    (total, pot) => total + BigInt(pot.totalContributed),
    BigInt(0),
  );
  const openPotCount = pots?.filter((pot) => pot.contributionOpen).length ?? 0;

  if (!isConnected || !address) {
    return (
      <div
        className="organizer-dashboard-content"
        id="main-content"
        tabIndex={-1}
      >
        <div className="organizer-dashboard-intro">
          <p className="pot-eyebrow">MY POTS</p>
          <h1>See pots linked to your wallet.</h1>
          <p>
            Connect your wallet to see public pots you started or contributed
            to. Connecting does not approve a payment.
          </p>
        </div>
        <WalletConnection />
      </div>
    );
  }

  return (
    <div
      className="organizer-dashboard-content"
      id="main-content"
      tabIndex={-1}
    >
      <div className="organizer-dashboard-intro">
        <p className="pot-eyebrow">MY POTS</p>
        <h1>Pots linked to your wallet.</h1>
        <p>
          Showing public pots for{" "}
          <strong title={address}>{shortAddress(address)}</strong>. New activity
          can take time to appear. We show up to 25 pots you created and your
          250 most recent contributions. Private pots are not shown.
        </p>
        <Link className="organizer-plan-link" href="/create">
          Plan a pot <span aria-hidden="true">→</span>
        </Link>
      </div>

      {onSupportedNetwork &&
        !isLoading &&
        !isError &&
        !isParticipatedLoading &&
        !isParticipatedError && (
          <section
            className="organizer-dashboard-totals"
            aria-label="Current amounts for listed public pots"
          >
            <article>
              <span>In public pots you started</span>
              <strong>{formatUsdc(totalEscrow?.toString() ?? "0")}</strong>
              <small>Current amounts in the public pots listed below.</small>
            </article>
            <article>
              <span>You contributed to the listed pots</span>
              <strong>
                {formatUsdc(totalWalletContributions?.toString() ?? "0")}
              </strong>
              <small>
                Total contributed before refunds. Private pots are not included.
              </small>
            </article>
          </section>
        )}

      {!onSupportedNetwork ? (
        <section className="organizer-dashboard-notice" role="status">
          <h2>Switch to Base Sepolia</h2>
          <p>
            These pots are on the Base Sepolia test network. Switch your wallet
            to Base Sepolia to see them.
          </p>
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
          {switchError && (
            <p className="wallet-error" role="alert">
              {switchError.message}
            </p>
          )}
        </section>
      ) : (
        <section
          className="organizer-pot-list"
          aria-labelledby="organizer-pot-list-title"
        >
          <div className="organizer-pot-list-heading">
            <h2 id="organizer-pot-list-title">Pots you created</h2>
            <span>Base Sepolia</span>
          </div>

          {isLoading ? (
            <div
              className="organizer-list-state"
              role="status"
              aria-live="polite"
            >
              <span className="pot-state-indicator" />
              <p>Looking for public pots you started…</p>
            </div>
          ) : isError ? (
            <div
              className="organizer-list-state organizer-list-error"
              role="alert"
            >
              <p>
                {error instanceof Error
                  ? error.message
                  : "Could not load pots for this wallet."}
              </p>
              <button type="button" onClick={() => void refetch()}>
                Try again
              </button>
            </div>
          ) : !pots?.length ? (
            <div className="organizer-list-state organizer-list-empty">
              <span className="pot-empty-mark" aria-hidden="true">
                —
              </span>
              <div>
                <h3>No public pots from this wallet yet</h3>
                <p>
                  A pot appears here after it has been created and added to the
                  public list.
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
                        {fundingRuleLabel(pot.fundingMode)} · Started on Base
                        Sepolia · {formatUsdc(pot.escrowBalance)} currently in
                        the pot
                      </span>
                    </span>
                    <span
                      className="organizer-pot-card-action"
                      aria-hidden="true"
                    >
                      Open →
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {onSupportedNetwork && !isLoading && !isError && (
        <section
          className="organizer-analytics"
          aria-labelledby="organizer-analytics-title"
        >
          <div className="organizer-analytics-heading">
            <div>
              <p className="pot-eyebrow">CONFIRMED ON BASE SEPOLIA</p>
              <h2 id="organizer-analytics-title">Your organizer overview</h2>
            </div>
            <button type="button" onClick={() => downloadPotReport(pots ?? [])}>
              Download CSV
            </button>
          </div>
          <div className="organizer-analytics-grid">
            <article>
              <span>Public pots listed</span>
              <strong>{pots?.length ?? 0}</strong>
              <small>Up to 25 most recent public pots</small>
            </article>
            <article>
              <span>Contributions received</span>
              <strong>{formatUsdc(totalRaised?.toString() ?? "0")}</strong>
              <small>Confirmed total across listed pots</small>
            </article>
            <article>
              <span>Currently in those pots</span>
              <strong>{formatUsdc(totalEscrow?.toString() ?? "0")}</strong>
              <small>Current verified balances</small>
            </article>
            <article>
              <span>Accepting contributions</span>
              <strong>{openPotCount}</strong>
              <small>Based on current contract rules</small>
            </article>
          </div>
        </section>
      )}

      {onSupportedNetwork && (
        <OrganizerTools address={address} pots={pots ?? []} />
      )}

      {onSupportedNetwork && (
        <section
          className="organizer-pot-list organizer-participated-pot-list"
          aria-labelledby="participated-pot-list-title"
        >
          <div className="organizer-pot-list-heading">
            <h2 id="participated-pot-list-title">Pots you contributed to</h2>
            <span>Base Sepolia</span>
          </div>

          {isParticipatedLoading ? (
            <div
              className="organizer-list-state"
              role="status"
              aria-live="polite"
            >
              <span className="pot-state-indicator" />
              <p>Checking your recent contributions…</p>
            </div>
          ) : isParticipatedError ? (
            <div
              className="organizer-list-state organizer-list-error"
              role="alert"
            >
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
              <span className="pot-empty-mark" aria-hidden="true">
                —
              </span>
              <div>
                <h3>No public contributions found yet</h3>
                <p>
                  This list includes public pots and recent confirmed
                  contributions. New contributions may take time to appear.
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
                        {fundingRuleLabel(pot.fundingMode)} · You contributed{" "}
                        {formatUsdc(pot.contributedAmount)} in total;{" "}
                        {formatUsdc(pot.escrowBalance)} remains in the pot
                      </span>
                    </span>
                    <span
                      className="organizer-pot-card-action"
                      aria-hidden="true"
                    >
                      Open →
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <div className="organizer-dashboard-account">
        <span>Wallet: {shortAddress(address)}</span>
        <Link href="/connect">Change wallet</Link>
      </div>
    </div>
  );
}
