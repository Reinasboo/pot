# POT

POT is a group-payment product in development. It is designed to help people create shared
fundraising pots, invite contributors, track confirmed USDC contributions, and settle funds under
clear rules on Base.

The app currently includes a product landing page, Base Sepolia wallet onboarding, a wallet-free
public pot route, a local-only pot planning flow, local factory/pot contract prototypes with
Foundry tests, and an event-indexer implementation. The contracts have not been deployed, and
live contributions, payouts, refunds, and database indexing have not been validated against
deployed services. The landing page shows settlement-rule examples, not balances or live activity.

## Project structure

- `apps/web` — Next.js App Router application.
- `/connect` — wallet onboarding for Coinbase Wallet and injected wallets on Base Sepolia.
- `/dashboard` — public, indexed pots associated with the connected wallet.
- `/create` — configure settlement rules, preview a pot, and optionally save a local browser draft; no pot is deployed.
- `/pot/{address}` — public read-only view of a deployed and indexed pot.
- `contracts` — Foundry factory and pot contracts with a local test suite; not deployed.
- `supabase` — pot metadata/event schema and RLS migration; no project configured yet.
- `docs` — product, architecture, roadmap, security, and deployment notes.

## Run the web app

Requirements: Node.js 20.9 or later and npm.

```powershell
cd apps\web
npm install
npm run dev
```

Open the local URL printed by Next.js. The application currently needs no wallet, database, or
environment variables to render. Connecting a wallet requires a compatible wallet provider in
the browser.

## Checks

Run from `apps\web`:

```powershell
npm run lint
npm run build
```

## Product and engineering notes

- [Product definition](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Security requirements](docs/SECURITY.md)
- [Deployment notes](docs/DEPLOYMENT.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)
- [Contract rules and tests](docs/CONTRACTS.md)
- [Indexer setup and operations](docs/INDEXING.md)

The intended development network is Base Sepolia (chain ID `84532`). No contract or token address
has been configured or deployed by this project yet. Do not treat the current site as a live
financial product.
