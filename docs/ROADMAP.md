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

The implementation includes Base Sepolia wallet onboarding, local factory/pot contract
prototypes, a recoverable event-indexer implementation, and a wallet-free public pot page. The
dashboard lists bounded sets of indexed public pots and shows chain-verified amounts for those
pots. Create, contribute, payout, and refund flows are wired with transaction and receipt handling,
but remain gated until a verified factory, Builder Code, and test environment are configured. The
contracts and indexer are not deployed, so the complete onchain journey has not been validated.

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
