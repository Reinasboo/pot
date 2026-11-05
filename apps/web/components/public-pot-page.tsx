"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPublicPotState, type PublicPotDetails } from "@/lib/public-pot";
import { formatDisplayAmount } from "@/lib/format-amount";
import { PotContribution } from "@/components/pot-contribution";
import { PotMetadataEditor } from "@/components/pot-metadata-editor";
import { PotSettlement } from "@/components/pot-settlement";
import { SharePotLink } from "@/components/share-pot-link";
import { PotCommunityPanel } from "@/components/pot-community-panel";

type Props = { address: string };
type LoadState =
  | { status: "loading" }
  | { status: "loaded"; pot: PublicPotDetails }
  | { status: "error"; message: string };

function getPrivateAccessKeyFromUrl(): string | null {
  const value = new URLSearchParams(window.location.hash.slice(1)).get(
    "access",
  );
  return value && /^[0-9a-f]{64}$/.test(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublicPotDetails(value: unknown): value is PublicPotDetails {
  if (!isRecord(value)) return false;
  return (
    typeof value.address === "string" &&
    typeof value.chainId === "number" &&
    typeof value.organizer === "string" &&
    typeof value.payoutRecipient === "string" &&
    /^0x[\da-fA-F]{40}$/.test(value.payoutRecipient) &&
    Number.isInteger(value.fundingMode) &&
    Number(value.fundingMode) >= 0 &&
    Number(value.fundingMode) <= 3 &&
    typeof value.token === "string" &&
    typeof value.name === "string" &&
    typeof value.metadataURI === "string" &&
    typeof value.description === "string" &&
    (typeof value.coverImageUrl === "string" || value.coverImageUrl === null) &&
    typeof value.isPublic === "boolean" &&
    typeof value.targetBased === "boolean" &&
    typeof value.targetAmount === "string" &&
    typeof value.deadline === "string" &&
    typeof value.minimumContribution === "string" &&
    typeof value.totalContributed === "string" &&
    typeof value.totalRefunded === "string" &&
    typeof value.totalPaidOut === "string" &&
    typeof value.currentBalance === "string" &&
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

function formattedAmount(
  amount: string,
  decimals: number,
  symbol: string,
): string {
  return formatDisplayAmount(amount, decimals, symbol);
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

function eventDescription(
  eventName: string,
  eventData: Record<string, unknown>,
  symbol: string,
  decimals: number,
) {
  if (eventName === "ContributionMade") {
    const contributor =
      typeof eventData.contributor === "string"
        ? shortAddress(eventData.contributor)
        : "A contributor";
    const amount =
      typeof eventData.amount === "string"
        ? formattedAmount(eventData.amount, decimals, symbol)
        : "";
    return { title: `${contributor} contributed`, detail: amount };
  }
  if (eventName === "PotPaidOut") {
    return {
      title: "Pot paid out",
      detail:
        typeof eventData.amount === "string"
          ? formattedAmount(eventData.amount, decimals, symbol)
          : "",
    };
  }
  if (eventName === "ContributionRefunded") {
    const contributor =
      typeof eventData.contributor === "string"
        ? shortAddress(eventData.contributor)
        : "A contributor";
    const amount =
      typeof eventData.amount === "string"
        ? formattedAmount(eventData.amount, decimals, symbol)
        : "";
    return { title: `${contributor} claimed a refund`, detail: amount };
  }
  return { title: "Pot created", detail: "" };
}

function ActivityMark({ eventName }: { eventName: string }) {
  const mark =
    eventName === "PotPaidOut"
      ? "↗"
      : eventName === "ContributionRefunded"
        ? "↩"
        : "+";
  return (
    <span className="pot-activity-mark" aria-hidden="true">
      {mark}
    </span>
  );
}

export function PublicPotPage({ address }: Props) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [privateAccessKey, setPrivateAccessKey] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getPrivateAccessKeyFromUrl(),
  );

  useEffect(() => {
    const controller = new AbortController();
    const accessKey = getPrivateAccessKeyFromUrl();

    async function loadPot() {
      try {
        const response = await fetch(
          `/api/pots/${encodeURIComponent(address)}`,
          {
            cache: "no-store",
            signal: controller.signal,
            headers: accessKey ? { "x-pot-access-key": accessKey } : undefined,
          },
        );
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
          setState({
            status: "error",
            message: "Pot details were returned in an invalid format.",
          });
          return;
        }

        setState({ status: "loaded", pot: data });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Could not load this pot.",
        });
      }
    }

    void loadPot();
    return () => controller.abort();
  }, [address, refreshKey]);

  useEffect(() => {
    function handleHashChange() {
      setPrivateAccessKey(getPrivateAccessKeyFromUrl());
      setRefreshKey((current) => current + 1);
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function handleMetadataSaved(isPublic: boolean, accessKey: string | null) {
    const url = new URL(window.location.href);
    url.hash = isPublic || !accessKey ? "" : `access=${accessKey}`;
    window.history.replaceState(null, "", url);
    setPrivateAccessKey(isPublic ? null : accessKey);
    setRefreshKey((current) => current + 1);
  }

  if (state.status === "loading") {
    return (
      <div
        className="public-pot-state"
        id="main-content"
        tabIndex={-1}
        role="status"
        aria-live="polite"
      >
        <span className="pot-state-indicator" />
        <h1>Loading this pot…</h1>
        <p>Checking its current balance and rules on Base Sepolia.</p>
        <div className="pot-loading-line" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className="public-pot-state"
        id="main-content"
        tabIndex={-1}
        role="alert"
      >
        <span className="pot-state-indicator pot-state-indicator-error">!</span>
        <p className="pot-eyebrow">POT LINK</p>
        <h1>We can’t open this pot.</h1>
        <p>{state.message}</p>
        <Link className="pot-secondary-link" href="/">
          Return to POT <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  const { pot } = state;
  const total = BigInt(pot.totalContributed);
  const target = BigInt(pot.targetAmount);
  const isCrowdfunding = pot.fundingMode === 2 || pot.fundingMode === 3;
  const progress =
    pot.targetBased && target > BigInt(0)
      ? Number((total * BigInt(10_000)) / target) / 100
      : null;
  const progressWidth = Math.min(progress ?? 0, 100);
  const status = getPublicPotState(pot);
  const visibleEvents = pot.events.filter(
    (event) => event.eventName !== "PotCreated",
  );

  return (
    <div className="public-pot-content" id="main-content" tabIndex={-1}>
      <section className="public-pot-summary">
        <div className="public-pot-main">
          <div className="pot-status-line">
            <span
              className={`pot-state-indicator${pot.paidOut ? " pot-state-indicator-complete" : ""}`}
            />
            <span>{status}</span>
          </div>
          <p className="pot-eyebrow">GROUP FUND · BASE SEPOLIA TEST NETWORK</p>
          <h1>{pot.name}</h1>
          {pot.description && (
            <p className="public-pot-description">{pot.description}</p>
          )}
          <div className="pot-organizer">
            <span className="pot-organizer-mark" aria-hidden="true">
              P
            </span>
            <span>
              Organized by{" "}
              <Link href={`/organizer/${pot.organizer}`}>
                <strong title={pot.organizer}>
                  {shortAddress(pot.organizer)}
                </strong>
              </Link>
            </span>
          </div>
          {!pot.isPublic && (
            <p className="pot-private-badge">
              Private · anyone with this link can open it
            </p>
          )}
          <SharePotLink
            name={pot.name}
            address={pot.address}
            isPublic={pot.isPublic}
            accessKey={privateAccessKey}
          />
          <PotMetadataEditor
            address={pot.address}
            organizer={pot.organizer}
            initialIsPublic={pot.isPublic}
            initialAccessKey={privateAccessKey}
            initialDescription={pot.description}
            onPublished={handleMetadataSaved}
          />
        </div>

        <aside className="pot-funding-panel" aria-label="Pot funding summary">
          <div className="pot-funding-heading">
            <span>Total contributed</span>
            <span className="pot-chain-badge">
              <i /> Base Sepolia
            </span>
          </div>
          <p className="pot-collected">
            {formattedAmount(
              pot.totalContributed,
              pot.tokenDecimals,
              pot.tokenSymbol,
            )}
          </p>
          {pot.targetBased && (
            <>
              <div className="pot-target-row">
                <span>
                  {isCrowdfunding ? "Fundraising goal" : "Group goal"}
                </span>
                <strong>
                  {formattedAmount(
                    pot.targetAmount,
                    pot.tokenDecimals,
                    pot.tokenSymbol,
                  )}
                </strong>
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
                <span>
                  {formattedAmount(
                    (target > total ? target - total : BigInt(0)).toString(),
                    pot.tokenDecimals,
                    pot.tokenSymbol,
                  )}{" "}
                  to go
                </span>
              </div>
            </>
          )}
          <div className="pot-funding-divider" />
          <div className="pot-rule-row">
            <span>Money rules</span>
            <strong>
              {pot.fundingMode === 0
                ? "Goal + deadline; refund if missed"
                : pot.fundingMode === 1
                  ? "Organizer decides"
                  : pot.fundingMode === 2
                    ? "Crowdfunding; payout after deadline"
                    : "Crowdfunding; recipient may withdraw anytime"}
            </strong>
          </div>
          {isCrowdfunding && (
            <div className="pot-rule-row">
              <span>Approved payout wallet</span>
              <strong
                className="pot-payout-recipient"
                title={pot.payoutRecipient}
              >
                {pot.payoutRecipient}
              </strong>
            </div>
          )}
          <div className="pot-rule-row">
            <span>Deadline</span>
            <strong>
              {pot.deadline === "0"
                ? "No deadline"
                : formatDeadline(pot.deadline)}
            </strong>
          </div>
          <div className="pot-rule-row">
            <span>Smallest contribution</span>
            <strong>
              {formattedAmount(
                pot.minimumContribution,
                pot.tokenDecimals,
                pot.tokenSymbol,
              )}
            </strong>
          </div>
          <div className="pot-rule-row">
            <span>Current pot balance</span>
            <strong>
              {formattedAmount(
                pot.currentBalance,
                pot.tokenDecimals,
                pot.tokenSymbol,
              )}
            </strong>
          </div>
          {isCrowdfunding && (
            <p className="pot-crowdfunding-notice">
              Crowdfunding contributions cannot be refunded. Only the approved
              wallet can withdraw the funds.
            </p>
          )}
          <PotContribution
            pot={pot}
            onConfirmed={() => setRefreshKey((current) => current + 1)}
          />
        </aside>
      </section>

      <section className="pot-rules-strip" aria-label="Settlement conditions">
        <div className="pot-rule-symbol" aria-hidden="true">
          i
        </div>
        <div>
          <h2>
            {isCrowdfunding
              ? "How crowdfunding withdrawals work"
              : pot.targetBased
                ? "If the group sets a goal"
                : "If the organizer decides"}
          </h2>
          <p>
            {pot.fundingMode === 0
              ? "The organizer can withdraw after the goal is reached. If the deadline passes below the goal, each person can claim back their own contribution. Refunds are not automatic."
              : pot.fundingMode === 1
                ? "There is no goal, deadline, or refund rule. Once someone has contributed, the organizer can withdraw the money."
                : pot.fundingMode === 2
                  ? "The goal is a target, not a cap. Contributions stay open until the deadline. Then the approved wallet can withdraw all funds, whether or not the goal was reached. Contributors cannot claim refunds."
                  : "The goal is a target, not a cap. The approved wallet can withdraw the current balance at any time, and contributions stay open until the deadline. Contributors cannot claim refunds."}
          </p>
        </div>
        {pot.refundEligible && (
          <span className="pot-refund-status">
            You can claim your contribution back
          </span>
        )}
        {pot.payoutEligible && (
          <span className="pot-refund-status">
            {isCrowdfunding
              ? "Approved wallet can withdraw"
              : "Organizer can withdraw"}
          </span>
        )}
      </section>

      <PotSettlement
        pot={pot}
        onConfirmed={() => setRefreshKey((current) => current + 1)}
      />

      <section className="pot-activity-section">
        <div className="pot-activity-heading">
          <div>
            <p className="pot-eyebrow">CONFIRMED ON BASE SEPOLIA</p>
            <h2>Money in and out</h2>
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
            <span className="pot-empty-mark" aria-hidden="true">
              —
            </span>
            <div>
              <h3>No money has moved in this pot yet</h3>
              <p>
                Confirmed contributions, withdrawals, and claimed refunds will
                appear here after they are recorded and added to POT’s list.
              </p>
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
                    <span>
                      Block {BigInt(event.blockNumber).toLocaleString()}
                    </span>
                  </div>
                  {description.detail && (
                    <span className="pot-event-amount">
                      {description.detail}
                    </span>
                  )}
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
      {pot.isPublic && (
        <PotCommunityPanel
          address={pot.address}
          organizer={pot.organizer}
          totalContributed={pot.totalContributed}
          targetAmount={pot.targetAmount}
          tokenDecimals={pot.tokenDecimals}
          tokenSymbol={pot.tokenSymbol}
        />
      )}
      <p className="pot-address-note">
        {pot.isPublic
          ? "View this pot’s public record on BaseScan: "
          : "Private link access applies only in POT. This pot’s address and transactions are public on Base: "}
        <a
          href={`${pot.explorerUrl}/address/${pot.address}`}
          target="_blank"
          rel="noreferrer"
        >
          {shortAddress(pot.address)} ↗
        </a>
      </p>
    </div>
  );
}
