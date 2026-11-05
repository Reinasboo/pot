# POT

For this checkout's current local features, design changes, checks, and deployment path, see
[Local build and verification](docs/LOCAL_BUILD.md). Start the app from `apps/web` with
`npm ci` and `npm run dev`. Use Node.js 24 LTS to match CI.

Brand guidance is in [BRAND.md](docs/BRAND.md), social previews in
[SOCIAL_SHARING.md](docs/SOCIAL_SHARING.md), and the proposed network token rationale in
[TOKEN_VISION.md](docs/TOKEN_VISION.md). The submission assets are in [deliverables](deliverables),
with editable film and screenshot source in [apps/film](apps/film).

POT is a group-payment product in development. It is designed to help people create shared
fundraising pots, invite contributors, track confirmed USDC contributions, and settle funds under
clear rules on Base.

The public frontend is deployed at <https://potonbase.vercel.app>. This is a frontend deployment
only; no POT factory has been deployed and no live financial journey has been validated.

The app currently includes a product landing page, Base Sepolia wallet onboarding, a public pot
page, an organizer dashboard, and a pot creation form. Creation, contribution, payout, and refund
transaction flows are implemented with chain checks, receipt handling, and Builder Code gating.
They remain unavailable until a verified factory, Builder Code, and test environment are configured;
no live financial journey has been validated against deployed services. The contracts have not
been deployed, and the landing page shows settlement-rule examples rather than balances or live
activity.

## Project structure

- `apps/web` — Next.js App Router application.
- `/connect` — wallet onboarding for Coinbase Wallet and injected wallets on Base Sepolia.
- `/roadmap` — directly accessible summary of current and planned product stages.
- `/dashboard` — public, indexed pots associated with the connected wallet, with chain-verified
  financial amounts for the listed pots. Discovery is bounded and does not include private,
  undiscovered, or unindexed pots.
- `/create` — configure settlement rules, preview a pot, optionally save a local browser draft,
  and create onchain when the factory, wallet, network, token, and Builder Code checks pass.
- `/pot/{address}` — public pot state and indexed activity, with contribution and settlement
  actions that remain gated until the required deployment and attribution settings are configured.
  The connected organizer can separately sign and publish a public description after the pot is
  indexed.
- `contracts` — Foundry factory and pot contracts with a local test suite; not deployed.
- `supabase` — pot metadata/event schema and RLS migrations, including organizer-authorized public
  description updates; a Base Sepolia project is provisioned and migrations are applied, but no
  factory has been deployed or indexed.
- `docs` — product, architecture, roadmap, security, and deployment notes.

## Run the web app

Requirements: Node.js 20.9 or later and npm.

```powershell
cd apps\web
npm install
npm run dev
```

Open the local URL printed by Next.js. The landing page and local pot planner can render without
wallet or database configuration. Public pot data and dashboard reads require Base Sepolia RPC,
factory, and Supabase settings; transaction flows additionally require a deployed verified
factory, wallet, and public Builder Code. See `apps/web/.env.example` and the deployment notes.

## Checks

Run from `apps\web`:

```powershell
npm test
npm run lint
npm run build
npm run test:e2e
```

The web tests cover pot setup validation and browser journeys. Build the production app before
running Playwright; install Chromium once with `npx playwright install chromium`. Contract
formatting and Foundry tests run from `contracts`:

```powershell
npm ci
npm run fmt:check
npm test
```

For a read-only Base Sepolia check of the two test-wallet balances, copy `.env.example` to
`.env.local`, set the two public wallet addresses, and run `npm run check:testnet`.

Both sets of checks run in GitHub Actions for pushes to `main`, pull requests, and manual runs.

## Product and engineering notes

- [Product definition](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Security requirements](docs/SECURITY.md)
- [Deployment notes](docs/DEPLOYMENT.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)
- [Contract rules and tests](docs/CONTRACTS.md)
- [Indexer setup and operations](docs/INDEXING.md)
- [Base Sepolia test-wallet setup](docs/TESTNET_WALLET_SETUP.md)

The intended development network is Base Sepolia (chain ID `84532`). Circle's official test USDC
address has been verified, but no POT factory has been deployed or configured. Do not treat the
current site as a live financial product.
