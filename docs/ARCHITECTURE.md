# Architecture

## Current state

`apps/web` is a Next.js App Router application written in TypeScript. The landing page is static.
Wallet onboarding uses wagmi, viem, and React Query, with a client-side provider boundary in
`app/providers.tsx` and chain configuration in `lib/wagmi.ts`.

## Target MVP architecture

- **Web:** Next.js App Router, TypeScript, responsive interface.
- **Wallet and chain client:** wagmi and viem, restricted to Base Sepolia for the initial demo.
- **Settlement:** Solidity contracts built and tested with Foundry; USDC is the settlement asset.
- **Metadata and indexing:** Supabase for non-authoritative metadata and indexed contract events.
- **Deployment:** Vercel for the web application; testnet contracts for the initial demonstration.

Do not restructure the repository to match a target layout unless the existing implementation
needs it.

The current wallet route supports Coinbase Wallet and injected providers. Wallet connection
requests account access; it does not sign a transaction. Pot creation, USDC contributions,
organizer payout, and contributor refunds are implemented as gated write flows on Base Sepolia;
none has been validated against a deployed factory.
The Base Sepolia chain ID and explorer configuration come from viem's chain definition. The
configured public RPC is appropriate only for testnet development, not production.
The Wagmi client appends an ERC-8021 Builder Code suffix when the public
`NEXT_PUBLIC_BASE_BUILDER_CODE` value is configured. Every transaction flow must call the
fail-closed attribution guard and remains disabled until a code and verified factory are configured.

The initial contract implementation is in `contracts/src`. A factory is deployed with one
settlement token and creates isolated pot instances. Settlement rules and tests are documented in
`CONTRACTS.md`; contracts are not deployed.

## Source of truth

The chain is authoritative for confirmed contribution amounts, payout state, refund eligibility,
and settlement. Supabase may cache pot metadata and indexed activity, but displayed financial
state must be checked against or reconciled with contract events and chain reads.

The initial indexer and schema are in `apps/web/app/api/indexer/route.ts` and
`supabase/migrations`. Indexing is serialized with a database lease, idempotent by chain ID,
transaction hash, and log index, and guarded by a confirmation depth. A detected cursor-tip
reorganization rewinds the cache to the configured factory deployment block. This recovery can
require multiple batches to catch up. The indexer does not rely on contributor browser sessions.

See `INDEXING.md` for the database tables, access policies, required server configuration, and
remaining end-to-end setup.

The public pot route lives at `/pot/[address]`. It reads financial state directly from the
Base Sepolia factory and pot contract, formats amounts using the onchain token decimals, and uses
Supabase only for display metadata and confirmed event history. The contribution panel verifies the
configured factory, pot registration, Circle USDC, wallet balance, and live contribution rules
before enabling writes. It requests an exact-amount USDC approval only when the current allowance
is insufficient, then waits for transaction receipts; pending contributions are never counted.
The settlement panel exposes payout only to the organizer when `isPayoutEligible()` is true and a
refund only to a contributor with an unclaimed contribution when `isRefundEligible()` is true.
Both actions re-read the factory, token, caller-specific state, and contract eligibility before
writing, and wait for confirmation. Creation, contribution, payout, and refunds remain disabled
until a factory deployment and Builder Code are configured.

The wallet dashboard at `/dashboard` reads public pots created by the connected wallet and pots
with indexed confirmed contributions from that wallet, scoped to Base Sepolia. The participation
list searches the 250 latest indexed contribution events and shows up to 25 distinct public pots;
private pots and events not yet indexed are excluded. The dashboard reads current escrow balances
and contributor mappings directly from Base Sepolia at a consistent block, verifies the factory
and Circle USDC, and shows totals only for the listed public pots. Each pot page separately
verifies factory registration and reads its financial state from chain.

The `/create` route validates the pot name, optional purpose, settlement mode, six-decimal USDC
goal/minimum, and target-pot deadline before previewing rules. A factory create call is available
only when the connected wallet is on Base Sepolia, the configured factory reports Circle's
verified Base Sepolia USDC as its token, and a Builder Code is configured for Wagmi attribution.
The wallet prompts for transaction confirmation; the UI waits for the receipt and extracts the
`PotCreated` event before showing the new pot address. Purpose text remains local and is not
uploaded or included in the contract call. The form can optionally save a versioned draft to
browser `localStorage`; draft content stays on that device and has no server sync. It confirms
before overwriting, restoring over non-empty form values, or deleting a saved draft.

## Financial flow

The intended flow is:

1. The organizer submits validated pot configuration to the factory.
2. The factory deploys or registers a pot instance and emits a creation event.
3. Contributors approve and transfer the configured USDC token through the pot contract.
4. The contract records the contribution and emits an event.
5. The interface waits for transaction confirmation before updating funded totals.
6. The organizer executes an eligible payout, or contributors claim refunds when the configured
   target-pot rules allow it.

## Settlement modes

The MVP should define two unambiguous modes:

- **Flexible pot:** organizer-controlled withdrawal under rules disclosed before contribution.
- **Target pot:** payout only after the target is met; when a configured deadline expires below
  target, contributors may claim their contract-defined refunds.

No-deadline behavior must be explicit. Avoid combinations of organizer discretion, targets, and
deadlines that produce conflicting outcomes.

## Contract events

- `PotCreated`
- `ContributionMade`
- `PotPaidOut`
- `ContributionRefunded`

These events are emitted by the local contract implementation. The indexer is implemented locally
but has not been run against a configured Supabase project or deployed factory.
