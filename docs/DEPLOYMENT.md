# Development and deployment

## Local web development

Requirements: Node.js 20.9 or later and npm.

```powershell
cd apps\web
npm install
npm run dev
```

The landing page does not require environment variables or a database. The `/connect` route
requires a compatible wallet provider in the browser to establish a wallet connection.

## Validation

From `apps\web`:

```powershell
npm test
npm run lint
npm run build
npm run test:e2e
```

The Playwright browser suite uses Chromium and starts the built Next.js production server. Install
the browser once with `npx playwright install chromium`; CI installs it as part of the workflow.
Run `npm run build` before starting the browser suite.

Contract checks run from `contracts`:

```powershell
npm ci
npm run fmt:check
npm test
```

Use [`TESTNET_WALLET_SETUP.md`](./TESTNET_WALLET_SETUP.md) to create dedicated test accounts and
run the read-only chain/token/balance preflight before any future transaction testing.

GitHub Actions runs the web and contract checks on pushes to `main`, pull requests, and manual
workflow dispatches.

## Base Sepolia

The intended development network is Base Sepolia, chain ID `84532`. The documented public RPC is
`https://sepolia.base.org` and the explorer is `https://sepolia.basescan.org`. Public RPC endpoints
may be rate-limited; production deployments should use an appropriately configured provider and
must not expose provider credentials in client-side code.

No POT factory or USDC address is currently configured. Verify token and network configuration
from authoritative sources before adding them. Never invent addresses or secrets.

The event-indexing endpoint also requires a Supabase migration, a deployed factory, a verified
factory start block, and the server-side settings documented in `INDEXING.md`. The endpoint is
protected with `INDEXER_CRON_SECRET`; schedule it only from a trusted server-side scheduler.
The wallet-free public pot route additionally needs `SUPABASE_ANON_KEY` to load indexed display
metadata and activity.

For organizer/contributor account setup and the read-only balance check, see
[`TESTNET_WALLET_SETUP.md`](./TESTNET_WALLET_SETUP.md).

## Before a demo deployment

1. Complete and test the contracts and wallet flow on Base Sepolia.
2. Deploy and verify the contracts on the explorer.
3. Configure and test Supabase with RLS enabled, if indexing is included.
4. Set deployment environment variables without committing secrets.
5. Test a clean browser session and two separate wallets.
6. Verify public pot URLs, confirmed balances, payout/refund states, and explorer links.
7. Check responsive layouts and all error/recovery states.

Do not rush to mainnet. Mainnet is not appropriate until financial rules, token configuration,
testing, and security review are satisfactory.
