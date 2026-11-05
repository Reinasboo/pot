"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicDiscoveryPot } from "@/lib/public-pot";
import { formatDisplayAmount } from "@/lib/format-amount";

type ResultState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "loaded"; pots: PublicDiscoveryPot[] }
  | { status: "error"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDiscoveryPot(value: unknown): value is PublicDiscoveryPot {
  return (
    isRecord(value) &&
    typeof value.address === "string" &&
    /^0x[\da-fA-F]{40}$/.test(value.address) &&
    typeof value.organizer === "string" &&
    /^0x[\da-fA-F]{40}$/.test(value.organizer) &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    (typeof value.coverImageUrl === "string" || value.coverImageUrl === null) &&
    typeof value.targetAmount === "string" &&
    /^\d+$/.test(value.targetAmount) &&
    typeof value.deadline === "string" &&
    /^\d+$/.test(value.deadline) &&
    typeof value.createdBlock === "string" &&
    /^\d+$/.test(value.createdBlock) &&
    typeof value.fundingMode === "number" &&
    Number.isInteger(value.fundingMode) &&
    value.fundingMode >= 0 &&
    value.fundingMode <= 3 &&
    typeof value.escrowBalance === "string" &&
    /^\d+$/.test(value.escrowBalance) &&
    typeof value.totalContributed === "string" &&
    /^\d+$/.test(value.totalContributed) &&
    typeof value.contributionOpen === "boolean"
  );
}

function formatUsdc(amount: string): string {
  return formatDisplayAmount(amount);
}

function formatDeadline(deadline: string): string {
  if (deadline === "0") return "No deadline";
  const date = new Date(Number(deadline) * 1000);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
    : "Deadline unavailable";
}

function getFundingRule(mode: number): string {
  if (mode === 0) return "Goal with refunds";
  if (mode === 2) return "Crowdfunding";
  if (mode === 3) return "Withdraw as funds come in";
  return "Goal based";
}

export function PotDiscovery() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [state, setState] = useState<ResultState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadPots() {
      setState({ status: "loading" });
      try {
        const response = await fetch(
          `/api/pots/discover?q=${encodeURIComponent(submittedQuery)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const data: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (response.status === 503) {
          setState({ status: "unavailable" });
          return;
        }
        if (!response.ok) {
          setState({
            status: "error",
            message:
              isRecord(data) && typeof data.error === "string"
                ? data.error
                : "Could not load public pots.",
          });
          return;
        }
        if (!Array.isArray(data) || !data.every(isDiscoveryPot)) {
          setState({
            status: "error",
            message: "Public pot data was returned in an invalid format.",
          });
          return;
        }
        setState({ status: "loaded", pots: data });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not load public pots.",
        });
      }
    }
    void loadPots();
    return () => controller.abort();
  }, [submittedQuery, refreshKey]);

  return (
    <div className="discovery-page-content" id="main-content" tabIndex={-1}>
      <header className="discovery-heading">
        <p className="pot-eyebrow">PUBLIC POTS · BASE SEPOLIA</p>
        <h1>Find a group fund.</h1>
        <p>
          Browse public pots and check the money rules before you open one.
          Amounts are read from Base Sepolia.
        </p>
      </header>
      <form
        className="discovery-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmittedQuery(query.trim());
        }}
      >
        <label className="sr-only" htmlFor="pot-discovery-search">
          Search public pots
        </label>
        <input
          id="pot-discovery-search"
          maxLength={60}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or description"
          value={query}
        />
        <button className="wallet-action wallet-action-primary" type="submit">
          Search
        </button>
      </form>

      <section
        className="discovery-results"
        aria-labelledby="discovery-results-title"
      >
        <div className="discovery-results-heading">
          <h2 id="discovery-results-title">
            {submittedQuery ? "Search results" : "Recently listed"}
          </h2>
          <span>Public pots only</span>
        </div>
        {state.status === "loading" ? (
          <div className="organizer-list-state" role="status">
            <p>Looking for public pots…</p>
          </div>
        ) : state.status === "unavailable" ? (
          <div className="organizer-list-state organizer-list-empty">
            <h3>Public pots aren’t available yet</h3>
            <p>
              The testnet services are still being set up. You can make and
              share a plan without connecting a wallet.
            </p>
            <Link className="text-link" href="/create">
              Plan a pot
            </Link>
          </div>
        ) : state.status === "error" ? (
          <div
            className="organizer-list-state organizer-list-error"
            role="alert"
          >
            <p>{state.message}</p>
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
            >
              Try again
            </button>
          </div>
        ) : !state.pots.length ? (
          <div className="organizer-list-state organizer-list-empty">
            <h3>
              {submittedQuery
                ? "No pots match that search"
                : "No public pots are listed yet"}
            </h3>
            <p>
              {submittedQuery
                ? "Try a shorter search or another name."
                : "Check back when organizers publish public pots."}
            </p>
          </div>
        ) : (
          <ol className="discovery-pot-grid">
            {state.pots.map((pot) => {
              const target = BigInt(pot.targetAmount);
              const total = BigInt(pot.totalContributed);
              const progress =
                target > BigInt(0) ? (total * BigInt(100)) / target : BigInt(0);
              const progressWidth = Number(
                progress > BigInt(100) ? BigInt(100) : progress,
              );
              return (
                <li key={pot.address} className="discovery-pot-card">
                  <Link href={`/pot/${pot.address}`}>
                    <span className="discovery-pot-mark" aria-hidden="true">
                      POT
                    </span>
                    <span className="discovery-pot-rule">
                      {getFundingRule(pot.fundingMode)}
                    </span>
                    <strong>{pot.name}</strong>
                    <span className="discovery-pot-description">
                      {pot.description ||
                        "The organizer hasn’t added a description yet."}
                    </span>
                    <span className="discovery-pot-progress">
                      <span>
                        <b>{formatUsdc(pot.totalContributed)}</b> contributed
                      </span>
                      <span>{formatUsdc(pot.targetAmount)} goal</span>
                      <i aria-hidden="true">
                        <i style={{ width: `${progressWidth}%` }} />
                      </i>
                    </span>
                    <span className="discovery-pot-facts">
                      <span>
                        <b>{formatUsdc(pot.escrowBalance)}</b> currently in pot
                      </span>
                      <span>
                        {pot.contributionOpen
                          ? "Open for contributions"
                          : "Contributions closed"}{" "}
                        · {formatDeadline(pot.deadline)}
                      </span>
                    </span>
                    <span className="discovery-pot-open">
                      View pot <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
        {state.status === "loaded" && state.pots.length === 25 && (
          <p className="discovery-limit-note">
            Showing the 25 most recently listed pots.
          </p>
        )}
      </section>
    </div>
  );
}
