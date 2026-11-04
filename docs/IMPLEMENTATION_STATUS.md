# Implementation status

## Current milestone

**Foundation, contracts, and indexing — in progress**

Completed:

- Inspected the initially empty workspace and preserved the two source PDFs.
- Scaffolded `apps/web` with Next.js, TypeScript, and Tailwind.
- Replaced the starter screen with a responsive POT landing page and an explicitly illustrative
  pot preview.
- Reworked the landing page to explain settlement rules without sample balances or contributor
  activity, state prototype limitations, and direct visitors to real local planning and wallet routes.
- Added the roadmap section and initial product, architecture, security, and deployment documents.
- Added product metadata and a project README.
- Verified ESLint, a production build, local HTTP response, mobile page width, and in-page links.
- Added wagmi/viem Base Sepolia configuration, Coinbase Wallet and injected-wallet connect
  options, wallet status, network switching, and disconnect/error states.
- Verified the `/connect` route builds, returns HTTP 200, and has no mobile horizontal overflow.
- Added a Foundry factory and per-pot contracts using OpenZeppelin SafeERC20/ReentrancyGuard.
- Implemented flexible and target settlement modes, with explicit deadlines, contribution caps,
  organizer payout, and individual pull refunds.
- Added 32 Foundry tests for configuration, contributions, token behavior, payout/refund
  authorization, reentrancy, edge states, and failed-transfer rollback.
- Verified Foundry formatting, compilation, test suite, dependency audit, and contract bytecode
  sizes.
- Added Supabase tables, RLS policies, leased block indexing, idempotent event upserts, and a
  cursor reorg-recovery path.
- Verified the indexer route's authentication and missing-configuration responses locally.
- Added the Supabase migration, RLS policies, leased/recoverable cursor functions, and protected
  indexer route with confirmed-block indexing and a full rewind on detected cursor reorg.
- Provisioned a Base Sepolia Supabase project, applied all three migrations, configured its
  publishable and server-only secret keys in the ignored local web environment, and verified
  server-secret and public read access. The project currently has no indexed chain data.
- Verified the web build/lint and endpoint authentication behavior. Live indexing still requires
  a deployed factory, its deployment block, and Base Sepolia RPC configuration.
- Added a wallet-free public pot route that verifies factory registration, reads the settlement
  state and token decimals from Base Sepolia, and displays indexed activity with explorer links.
- Added a wallet-aware, read-only organizer dashboard for indexed public pots, scoped to the
  connected wallet and supported Base Sepolia network.
- Added organizer-authorized public description publishing with explicit consent, short-lived
  single-use wallet-signature challenges, onchain organizer verification, and Supabase persistence.
- Extended the wallet dashboard to list public pots created by the wallet and pots with indexed,
  confirmed contributions from it. Participation results are bounded to the 250 latest indexed
  contribution events.
- Added dashboard financial summaries from Base Sepolia reads at a consistent block: verifies the
  configured factory and Circle USDC, reads each listed pot’s escrow balance and the connected
  wallet’s contribution mapping, and clearly scopes totals to listed public pots.
- Added a client-side pot setup form with contract-aligned rule validation, a local-only preview,
  optional purpose text, and explicit versioned browser-local draft save/restore/clear actions
  with replacement confirmation. Purpose text stays local and is not published.
- Added Vitest coverage for pot amount parsing, exact decimal comparisons, Unicode limits, and
  target/flexible settlement validation.
- Added Playwright coverage for landing-to-planning navigation, invalid/valid rule previews,
  flexible settlement, confirmed local-draft restore/clear, mobile overflow, and an injected-wallet
  connect/wrong-network recovery/disconnect flow. The browser wallet is mocked; no transaction is
  sent.
- Verified Circle's official Base Sepolia USDC address against the live chain (84532, contract
  code present, USDC, 6 decimals); documented test-only organizer/contributor wallet setup and
  added a read-only balance preflight script.
- Added ERC-8021 Builder Code suffix generation at Wagmi client level and a fail-closed helper for
  transaction actions. The public code is not configured yet, so the create flow remains disabled.
- Wired the create-pot form to the factory ABI with USDC base-unit conversion, Base Sepolia
  network gating, onchain factory-token verification, Builder Code gating, transaction
  confirmation, and explorer-linked result states. The flow remains unavailable until a factory
  address and Builder Code are configured.
- Added a public-pot contribution form with exact six-decimal USDC parsing, suggested amounts,
  live factory/pot/token/balance checks, contribution-rule validation, exact-amount allowance
  approval, confirmed transaction states, and a refreshed onchain summary. It remains gated until
  the factory, Builder Code, wallet, network, and pot checks pass.
- Added a public-pot settlement panel with caller-scoped organizer payout and contributor refund
  eligibility, pre-transaction chain rechecks, confirmation states, and explorer links. It remains
  gated until the factory, Builder Code, wallet, and pot checks pass.
- Added GitHub Actions checks for web lint, unit tests, production build, and Foundry formatting
  and tests, including browser tests on Chromium.
- Added copy-link and native device-share actions to public pot pages.
- Added responsive loading, unavailable, empty-activity, funding, deadline, and settlement-rule
  states; no sample financial activity or fake contribution action is shown.
- Added named DM Sans / DM Serif Display typography and documented public-pot data requirements.

Still outstanding in this milestone:

- Add and validate a dedicated design-token system if the interface grows beyond the current page.
- Verify wallet connection/network switching and public-description publishing using an installed
  wallet.
- Run the indexer against Supabase and a deployed Base Sepolia factory; validate reorg recovery.
- Create and fund the user's two dedicated Base Sepolia test wallets, then run the wallet preflight.
- Obtain and configure a Builder Code before pot creation/deployment flows can be tested.
- Verify GitHub Actions when the account billing lock is resolved.

## Build phases

| Phase | Status | Remaining work |
|---|---|---|
| 0. Repository and foundation | In progress | Environment validation and final architecture decisions are pending service integration. |
| 1. Brand and website | In progress | Refine content and polish after core app flows are available. |
| 2. Wallet onboarding | In progress | Verify connection and network switching with real wallet providers; test rejection, disconnection, and unsupported-network recovery. |
| 3. Smart contracts | In progress | Independent security review and verified token/deployment configuration remain outstanding. |
| 4. Database and indexing | Supabase configured | Project provisioned and migrations applied; run against a deployed factory and validate live indexing/reorg recovery. |
| 5. Core application | In progress | Create, contribution, payout, and refund transaction flows are wired but gated on a deployed verified factory and Builder Code. Public dashboard totals cover only listed indexed pots; public description publishing requires the deployed factory and indexed public pot. Complete private-pot access is not implemented. Circle Base Sepolia USDC is verified; dedicated test wallets and Builder Code are not configured. |
| 6. Polish and demo | In progress | Verify CI; testnet flow, remaining responsive/error-state review, and repeatable two-wallet demo remain. |
| 7. Deployment and submission | Not started | Testnet deployment, contract verification, clean-session checks, final documentation. |

## Integration gates

- Transaction code must use the Wagmi ERC-8021 suffix and fail closed until a Builder Code is
  configured for the Base transaction-attribution requirement.
- Do not configure a USDC address until it has been verified from an authoritative Base Sepolia
  source.
- Do not claim live contributions, deployed contracts, indexing, refunds, or payouts until each is
  implemented and verified on testnet.
- Contract tests use a local mock token. Passing tests do not imply an audit or guarantee safety.
- The public metadata signature flow is locally implemented and tested, but remains unverified
  against a deployed factory. Supabase is configured and migrations are applied, but no indexed pot
  exists yet.
