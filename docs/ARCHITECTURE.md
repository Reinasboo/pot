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

The current wallet route supports Coinbase Wallet and injected providers. It requests account
access only; transaction signing and payment flows are not implemented. The Base Sepolia chain ID
and explorer configuration come from viem's chain definition. The configured public RPC is
appropriate only for testnet development, not production.

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
Supabase only for display metadata and confirmed event history. It is intentionally read-only
until a factory deployment and Builder Code are configured.

The organizer dashboard at `/dashboard` reads only public pot identity/configuration rows from
Supabase, scoped to the connected wallet address and Base Sepolia. It does not show balances or
claim that the cached list is complete; private pots and creations not yet indexed are excluded.
Each pot page separately verifies factory registration and reads its financial state from chain.

The `/create` route currently validates the pot name, optional purpose, settlement mode,
human-readable goal, minimum contribution, and target-pot deadline in the browser, then previews the rules. Amounts
remain human-readable strings because no settlement token or token decimals are configured. The
form can optionally save a versioned draft to browser `localStorage`; draft content stays on that
device and has no server sync or wallet dependency. The screen detects a saved draft, confirms
before overwriting it, and confirms before restoring over non-empty form values or deleting it.
Older local drafts without a purpose remain restorable. This is not an onchain create flow.

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
