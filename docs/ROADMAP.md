# Roadmap

These stages describe planned product direction, not a claim that the features are live. No
release dates are promised.

## 01 — Core payments

**Current MVP focus**

- Create and share pots.
- USDC contributions on Base.
- Verified funding progress and contribution history.
- Contract-enforced payout and refund rules.
- Transaction verification.

The implementation now includes Base Sepolia wallet onboarding, local factory/pot contract
prototypes, a recoverable event-indexer implementation, and a wallet-free public pot read page.
It also includes a read-only dashboard of indexed public pots for a connected organizer wallet.
The `/create` screen can validate and preview local rules and optionally save an unsubmitted draft
in the browser, but does not deploy a pot. The contracts and indexer are not deployed; onchain pot
creation, live contributions, payout/refund transactions, and their full end-to-end verification
remain to be built.

## 02 — Social experience

**Planned**

- Activity feeds.
- Reactions and contribution milestones.
- Shareable achievement cards.
- Public pot discovery.
- User profiles and reputation.

## 03 — Organizers and businesses

**Planned**

- Creator and community collections.
- Event collections.
- Organizer analytics.
- Branded pot pages.
- Premium management tools.

## 04 — POT infrastructure

**Future vision**

- Developer API.
- Embedded collections.
- Merchant integrations.
- Programmable group payments.
- Additional network support.
