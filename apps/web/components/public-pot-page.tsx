"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatTokenAmount, getPublicPotState, type PublicPotDetails } from "@/lib/public-pot";
import { PotContribution } from "@/components/pot-contribution";
import { SharePotLink } from "@/components/share-pot-link";

type Props = { address: string };
type LoadState =
  | { status: "loading" }
  | { status: "loaded"; pot: PublicPotDetails }
  | { status: "error"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublicPotDetails(value: unknown): value is PublicPotDetails {
  if (!isRecord(value)) return false;
  return (
    typeof value.address === "string" &&
    typeof value.chainId === "number" &&
    typeof value.organizer === "string" &&
    typeof value.token === "string" &&
    typeof value.name === "string" &&
    typeof value.metadataURI === "string" &&
    typeof value.description === "string" &&
    (typeof value.coverImageUrl === "string" || value.coverImageUrl === null) &&
    typeof value.targetBased === "boolean" &&
    typeof value.targetAmount === "string" &&
    typeof value.deadline === "string" &&
    typeof value.minimumContribution === "string" &&
    typeof value.totalContributed === "string" &&
    typeof value.totalRefunded === "string" &&
    typeof value.tokenDecimals === "number" &&
    typeof value.tokenSymbol === "string" &&
    typeof value.paidOut === "boolean" &&
    typeof value.contributionOpen === "boolean" &&
    typeof value.payoutEligible === "boolean" &&
    typeof value.refundEligible === "boolean" &&
    typeof value.explorerUrl === "string" &&
    Array.isArray(value.events) &&
    value.events.every(
      (event) =>
        isRecord(event) &&
        typeof event.transactionHash === "string" &&
        /^0x[\da-fA-F]{64}$/.test(event.transactionHash) &&
        Number.isInteger(event.logIndex) &&
        typeof event.blockNumber === "string" &&
        typeof event.eventName === "string" &&
        isRecord(event.eventData),
    )
  );
}

function formattedAmount(amount: string, decimals: number, symbol: string): string {
  const [whole, fraction = ""] = formatTokenAmount(amount, decimals).split(".");
  const groupedWhole = BigInt(whole).toLocaleString();
  const roundedFraction = fraction.slice(0, 2).replace(/0+$/, "");
  const formatted = roundedFraction ? `${groupedWhole}.${roundedFraction}` : groupedWhole;
  return `${formatted} ${symbol}`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatDeadline(deadline: string): string {
  const date = new Date(Number(deadline) * 1000);
  if (!Number.isFinite(date.getTime())) return "Deadline unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function eventDescription(eventName: string, eventData: Record<string, unknown>, symbol: string, decimals: number) {
  if (eventName === "ContributionMade") {
    const contributor = typeof eventData.contributor === "string" ? shortAddress(eventData.contributor) : "A contributor";
    const amount = typeof eventData.amount === "string" ? formattedAmount(eventData.amount, decimals, symbol) : "";
    return { title: `${contributor} contributed`, detail: amount };
  }
  if (eventName === "PotPaidOut") {
    return { title: "Pot paid out", detail: typeof eventData.amount === "string" ? formattedAmount(eventData.amount, decimals, symbol) : "" };
  }
  if (eventName === "ContributionRefunded") {
    const contributor = typeof eventData.contributor === "string" ? shortAddress(eventData.contributor) : "A contributor";
    const amount = typeof eventData.amount === "string" ? formattedAmount(eventData.amount, decimals, symbol) : "";
    return { title: `${contributor} claimed a refund`, detail: amount };
  }
  return { title: "Pot created", detail: "" };
}

function ActivityMark({ eventName }: { eventName: string }) {
  const mark = eventName === "PotPaidOut" ? "↗" : eventName === "ContributionRefunded" ? "↩" : "+";
  return <span className="pot-activity-mark" aria-hidden="true">{mark}</span>;
}

export function PublicPotPage({ address }: Props) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPot() {
      try {
        const response = await fetch(`/api/pots/${encodeURIComponent(address)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            isRecord(data) && typeof data.error === "string"
              ? data.error
              : "Could not load this pot.";
          setState({ status: "error", message });
          return;
        }

        if (!isPublicPotDetails(data)) {
          setState({ status: "error", message: "Pot details were returned in an invalid format." });
          return;
        }

        setState({ status: "loaded", pot: data });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Could not load this pot.",
        });
      }
    }

    void loadPot();
    return () => controller.abort();
  }, [address, refreshKey]);

  if (state.status === "loading") {
    return (
      <div className="public-pot-state" role="status" aria-live="polite">
        <span className="pot-state-indicator" />
        <h1>Loading pot details</h1>
        <p>Reading the pot state from Base Sepolia.</p>
        <div className="pot-loading-line" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="public-pot-state" role="alert">
        <span className="pot-state-indicator pot-state-indicator-error">!</span>
        <p className="pot-eyebrow">PUBLIC POT</p>
        <h1>Pot details aren’t available.</h1>
        <p>{state.message}</p>
        <Link className="pot-secondary-link" href="/">Return to POT <span aria-hidden="true">→</span></Link>
      </div>
    );
  }

  const { pot } = state;
  const total = BigInt(pot.totalContributed);
  const target = BigInt(pot.targetAmount);
  const progress = pot.targetBased && target > BigInt(0)
    ? Number((total * BigInt(10_000)) / target) / 100
    : null;
  const progressWidth = Math.min(progress ?? 0, 100);
  const status = getPublicPotState(pot);
  const visibleEvents = pot.events.filter((event) => event.eventName !== "PotCreated");

  return (
    <div className="public-pot-content">
      <section className="public-pot-summary">
        <div className="public-pot-main">
          <div className="pot-status-line">
            <span className={`pot-state-indicator${pot.paidOut ? " pot-state-indicator-complete" : ""}`} />
            <span>{status}</span>
          </div>
          <p className="pot-eyebrow">SHARED POT · BASE SEPOLIA</p>
          <h1>{pot.name}</h1>
          {pot.description && <p className="public-pot-description">{pot.description}</p>}
          <div className="pot-organizer">
            <span className="pot-organizer-mark" aria-hidden="true">P</span>
            <span>Organized by <strong title={pot.organizer}>{shortAddress(pot.organizer)}</strong></span>
          </div>
          <SharePotLink name={pot.name} />
        </div>

        <aside className="pot-funding-panel" aria-label="Pot funding summary">
          <div className="pot-funding-heading">
            <span>{pot.targetBased ? "Total contributed onchain" : "Collected so far"}</span>
            <span className="pot-chain-badge"><i /> Onchain</span>
          </div>
          <p className="pot-collected">{formattedAmount(pot.totalContributed, pot.tokenDecimals, pot.tokenSymbol)}</p>
          {pot.targetBased && (
            <>
              <div className="pot-target-row">
                <span>Goal</span>
                <strong>{formattedAmount(pot.targetAmount, pot.tokenDecimals, pot.tokenSymbol)}</strong>
              </div>
              <div
                className="pot-progress-track"
                role="progressbar"
                aria-label="Funding goal progress"
                aria-valuenow={Math.min(progress ?? 0, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${progressWidth}%` }} />
              </div>
              <div className="pot-progress-label">
                <span>{progress?.toFixed(1)}% funded</span>
                <span>{formattedAmount((target > total ? target - total : BigInt(0)).toString(), pot.tokenDecimals, pot.tokenSymbol)} to go</span>
              </div>
            </>
          )}
          <div className="pot-funding-divider" />
          <div className="pot-rule-row">
            <span>Settlement</span>
            <strong>{pot.targetBased ? "Goal-based" : "Flexible"}</strong>
          </div>
          <div className="pot-rule-row">
            <span>Deadline</span>
            <strong>{pot.deadline === "0" ? "No deadline" : formatDeadline(pot.deadline)}</strong>
          </div>
          <div className="pot-rule-row">
            <span>Minimum contribution</span>
            <strong>{formattedAmount(pot.minimumContribution, pot.tokenDecimals, pot.tokenSymbol)}</strong>
          </div>
          <PotContribution pot={pot} onConfirmed={() => setRefreshKey((current) => current + 1)} />
        </aside>
      </section>

      <section className="pot-rules-strip" aria-label="Settlement conditions">
        <div className="pot-rule-symbol" aria-hidden="true">i</div>
        <div>
          <h2>{pot.targetBased ? "Target pot rules" : "Flexible pot rules"}</h2>
          <p>
            {pot.targetBased
              ? "The organizer can withdraw after the goal is reached. If the deadline passes below the goal, contributors can claim refunds from the contract."
              : "The organizer can withdraw contributed funds. This flexible pot has no automatic refund rule."}
          </p>
        </div>
        {pot.refundEligible && <span className="pot-refund-status">Refunds available onchain</span>}
        {pot.payoutEligible && <span className="pot-refund-status">Payout eligible onchain</span>}
      </section>

      <section className="pot-activity-section">
        <div className="pot-activity-heading">
          <div>
            <p className="pot-eyebrow">VERIFIABLE ACTIVITY</p>
            <h2>Contribution history</h2>
          </div>
          <a
            className="pot-explorer-link"
            href={`${pot.explorerUrl}/address/${pot.address}`}
            target="_blank"
            rel="noreferrer"
          >
            View pot on BaseScan <span aria-hidden="true">↗</span>
          </a>
        </div>
        {visibleEvents.length === 0 ? (
          <div className="pot-activity-empty">
            <span className="pot-empty-mark" aria-hidden="true">—</span>
            <div>
              <h3>No contributions or settlements yet</h3>
              <p>Confirmed contribution and settlement events will appear here after indexing.</p>
            </div>
          </div>
        ) : (
          <ol className="pot-activity-list">
            {visibleEvents.map((event) => {
              const description = eventDescription(
                event.eventName,
                event.eventData,
                pot.tokenSymbol,
                pot.tokenDecimals,
              );
              return (
                <li key={`${event.transactionHash}-${event.logIndex}`}>
                  <ActivityMark eventName={event.eventName} />
                  <div className="pot-event-copy">
                    <strong>{description.title}</strong>
                    <span>Block {BigInt(event.blockNumber).toLocaleString()}</span>
                  </div>
                  {description.detail && <span className="pot-event-amount">{description.detail}</span>}
                  <a
                    className="pot-event-link"
                    href={`${pot.explorerUrl}/tx/${event.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View transaction ${shortAddress(event.transactionHash)}`}
                  >
                    {shortAddress(event.transactionHash)} ↗
                  </a>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <p className="pot-address-note">Pot contract <a href={`${pot.explorerUrl}/address/${pot.address}`} target="_blank" rel="noreferrer">{shortAddress(pot.address)} ↗</a></p>
    </div>
  );
}
