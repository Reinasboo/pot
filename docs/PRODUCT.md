# Product

## Vision

POT makes it easier for people to coordinate money around a shared goal. A group creates a pot,
shares its purpose and rules, invites contributors, sees confirmed contributions accumulate, and
settles funds according to those rules.

The product should feel like a clear consumer payment experience, not a crypto dashboard. People
should be able to understand a pot before connecting a wallet, and every financial rule should be
visible before contribution.

## Initial audience

The first audience is friend groups and community organizers, with use cases such as group gifts,
trips, events, and shared purchases. Families, creators, event organizers, and small businesses
are later audiences; the MVP is not a business banking product.

## MVP boundary

The MVP is one verifiable user journey:

1. Connect a compatible wallet on Base Sepolia.
2. Create a pot with explicit target, deadline, and settlement rules.
3. Share a stable public pot URL that works without wallet connection.
4. Contribute USDC and distinguish pending, confirmed, and failed transactions.
5. Show chain-verified funding progress and contribution history.
6. Execute an eligible payout or claim an eligible refund.
7. Link transactions to the Base Sepolia explorer.

Social feeds, reactions, achievements, public discovery, business accounts, subscriptions,
referrals, APIs, multi-chain support, and native mobile apps are deferred. They may appear on the
roadmap but must not be presented as working functionality.

## Product principles

- Coordination is the product; a payment button alone is not enough.
- Blockchain is the financial source of truth.
- Pending transactions never count as funded money.
- Settlement rules are explicit, understandable, and enforced by contracts.
- Do not imply automatic refunds or other outcomes the deployed contract does not enforce.
- Do not fabricate payment activity, balances, endorsements, audits, or partnerships.
- Minimize wallet friction and avoid unnecessary Web3 terminology in the primary journey.

## Current implementation status

The current implementation includes a branded landing page with a settlement-rules explainer,
Base Sepolia wallet onboarding, a wallet-free public pot route, a read-only organizer list of
indexed public pots, local factory/pot contract prototypes with Foundry tests, and a local
event-indexing route/schema. The dashboard does not show private pots or unindexed creations. The
contracts and indexer have not been deployed or run against a configured project, and there is no
live contribution or settlement activity. Wallet connection has not yet been verified end-to-end
with a separate installed wallet. Public pot pages include copy-link and native share actions.
The `/create` screen validates configuration and previews the selected rules locally. Organizers
may explicitly save and restore an unsubmitted draft in the same browser; no draft data is
uploaded or sent onchain. Drafts can also include an optional purpose description for contributors.
The form indicates when a local draft exists and asks for confirmation before replacing or
removing saved values.
