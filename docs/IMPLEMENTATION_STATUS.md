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
- Verified the web build/lint and endpoint authentication behavior. A live Supabase/factory run
  remains pending configuration.
- Added a wallet-free public pot route that verifies factory registration, reads the settlement
  state and token decimals from Base Sepolia, and displays indexed activity with explorer links.
- Added a wallet-aware, read-only organizer dashboard for indexed public pots, scoped to the
  connected wallet and supported Base Sepolia network.
- Added a client-side pot setup form with contract-aligned rule validation, a local-only preview,
  optional purpose text, and explicit versioned browser-local draft save/restore/clear actions
  with replacement confirmation; it submits no transaction.
- Added Vitest coverage for pot amount parsing, exact decimal comparisons, Unicode limits, and
  target/flexible settlement validation.
- Added Playwright coverage for landing-to-planning navigation, invalid/valid rule previews,
  flexible settlement, confirmed local-draft restore/clear, and mobile overflow.
- Verified Circle's official Base Sepolia USDC address against the live chain (84532, contract
  code present, USDC, 6 decimals); documented test-only organizer/contributor wallet setup and
  added a read-only balance preflight script.
- Added GitHub Actions checks for web lint, unit tests, production build, and Foundry formatting
  and tests, including browser tests on Chromium.
- Added copy-link and native device-share actions to public pot pages.
- Added responsive loading, unavailable, empty-activity, funding, deadline, and settlement-rule
  states; no sample financial activity or fake contribution action is shown.
- Added named DM Sans / DM Serif Display typography and documented public-pot data requirements.

Still outstanding in this milestone:

- Add and validate a dedicated design-token system if the interface grows beyond the current page.
- Verify wallet connection/network switching using an installed wallet.
- Run the indexer against Supabase and a deployed Base Sepolia factory; validate reorg recovery.
- Create and fund the user's two dedicated Base Sepolia test wallets, then run the wallet preflight.
- Obtain and integrate a Builder Code before transaction/deployment flows.
- Verify GitHub Actions when the account billing lock is resolved.

## Build phases

| Phase | Status | Remaining work |
|---|---|---|
| 0. Repository and foundation | In progress | Environment validation and final architecture decisions are pending service integration. |
| 1. Brand and website | In progress | Refine content and polish after core app flows are available. |
| 2. Wallet onboarding | In progress | Verify connection and network switching with real wallet providers; test rejection, disconnection, and unsupported-network recovery. |
| 3. Smart contracts | In progress | Independent security review and verified token/deployment configuration remain outstanding. |
| 4. Database and indexing | Implemented locally | Apply migrations and run against a configured Supabase project and deployed factory; live recovery/reconciliation remains to validate. |
| 5. Core application | In progress | Public pot page, indexed dashboard, and local creation-rule draft flow are implemented; onchain creation, private-pot access, contributions, payout, and refunds remain. Circle Base Sepolia USDC is verified; dedicated test wallets and Builder Code are not configured. |
| 6. Polish and demo | In progress | Verify CI; testnet flow, remaining responsive/error-state review, and repeatable two-wallet demo remain. |
| 7. Deployment and submission | Not started | Testnet deployment, contract verification, clean-session checks, final documentation. |

## Integration gates

- No wallet or contract transaction code should be considered complete until a Builder Code is
  available for the Base transaction-attribution requirement.
- Do not configure a USDC address until it has been verified from an authoritative Base Sepolia
  source.
- Do not claim live contributions, deployed contracts, indexing, refunds, or payouts until each is
  implemented and verified on testnet.
- Contract tests use a local mock token. Passing tests do not imply an audit or guarantee safety.
