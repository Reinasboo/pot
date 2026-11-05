# Local build and verification

This checkout is a locally runnable POT application. It does not require a database or wallet
to use the landing page, example templates, planner, draft storage, or plan exports.
No factory or live service configuration was supplied for this checkout. Historical deployment
statements elsewhere in the repository are not verification of this installation.

## Run

Use Node.js 24 LTS, matching CI, and npm.

```powershell
cd apps/web
npm ci
npm run dev
```

Open the URL printed by Next.js. To run a production build, use `npm run build` and `npm start`.

## What works locally

- Responsive landing page with interactive trip, gift, and community examples.
- Example selection opens an editable plan with the selected name, purpose, goal, and minimum.
- Three contract-aligned money rules, exact six-decimal USDC amounts, and future deadlines.
- Preview, explicit device-local draft save/restore/delete, and copy/download of plan terms.
- Wallet connection, network switching, and disconnection when a compatible provider is installed.
- Public-pot, discovery, organizer, and dashboard interfaces with loading, empty, and error states.
- Gated creation, contribution, payout, refund, signed metadata, private links, and indexing code.
- Branded missing-page recovery, keyboard focus handling, reduced-motion support, favicon,
  social preview image, and cache protection for API responses.

The exported text clearly identifies itself as a plan, not a published pot or payment request.
Private links limit access to the application page, not public blockchain records.

## Checks

From `apps/web`:

```powershell
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run check:setup
```

`check:setup` reports missing settings without printing secret values. It does not make network
requests. Add `-- --strict` to return a failure exit code when integration settings are incomplete.
Browser tests use injected wallet providers and intercepted service responses for integration
coverage; they do not prove a live testnet transaction.

From `contracts`:

```powershell
npm ci
npm run fmt:check
npm test
npm run build
```

Solidity files use LF line endings so Foundry formatting works consistently on Windows and CI.

## Configure Base Sepolia later

1. Deploy the verified factory with the existing settlement token on Base Sepolia.
2. Apply all five SQL migrations in filename order to the intended Supabase project, including
   community tools and private-link access. Keep the service key server-only.
3. Copy `apps/web/.env.example` to `.env.local`. Set both factory variables to the same address,
   the factory deployment block, RPC, Supabase keys, indexer secret, and actual Builder Code.
4. Run `npm run check:setup -- --strict`, then the read-only `npm run check:testnet` wallet preflight.
5. Rebuild the web application after changing any `NEXT_PUBLIC_` setting.
6. Call the protected indexer and confirm its cursor and database records.
7. Verify creation, contribution, confirmed balances, payout, and missed-goal refund using separate
   test wallets. Verify public and private metadata publishing and link access as well.

The testnet-only deployment script is `contracts/script/DeployBaseSepolia.s.sol`. It rejects
other chain IDs and checks that the expected token contract has the USDC symbol and six decimals.
Use an encrypted Foundry account; do not paste private keys into source files or command history.

```powershell
# Run from contracts. This simulates deployment; it does not broadcast.
npx forge script script/DeployBaseSepolia.s.sol:DeployBaseSepolia --rpc-url $env:BASE_SEPOLIA_RPC_URL --account pot-testnet
```

When the simulation has been reviewed, the same command with `--broadcast` performs deployment.
Record the deployed address, transaction, and block from the receipt, and verify the contract on
the explorer. This work did not broadcast or deploy any contract.

## Design direction

The primary promise is **Big plans. One shared pot.** The landing page speaks to organizers of
trips, group gifts, and community goals. Its next step is **Plan your pot**. Electric lime marks
the main action; warm paper and charcoal keep the page readable. Geist supplies one consistent
typeface across marketing and application screens. Examples are explicitly labelled, with no
fabricated contributors, endorsements, or payment activity.

## Remaining external work

Brand assets and voice are documented in [BRAND.md](BRAND.md). Social metadata, public pot cards,
privacy behavior, deployment requirements, and platform-cache checks are in
[SOCIAL_SHARING.md](SOCIAL_SHARING.md).
The edited product screenshots and narrated film live in `deliverables`; their editable project
and production notes are in `apps/film`. The future token rationale is in
[TOKEN_VISION.md](TOKEN_VISION.md).

Live services, an installed-wallet transaction journey, explorer verification, independent
contract review, and deployment are still required before a financial launch. Optional organizer
and community features already exist in code, but their presence is not evidence of a tested
deployment. The dependency audit currently reports moderate development-tool advisories through
the ESLint dependency tree; do not apply npm's suggested Next.js downgrade blindly.
