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

## Public frontend

The Next.js frontend is deployed at <https://potonbase.vercel.app> from the `apps/web` directory
using Vercel's Next.js preset and Node.js 24. Production and preview environments contain the
Base Sepolia RPC and Supabase URL, publishable key, and server-only secret. Vercel authentication
protection is disabled so the site is publicly accessible; do not put private operational routes
or sensitive data on this deployment.

This is a public frontend deployment, not a launch of a mainnet financial product. No factory
address, Builder Code, mainnet RPC, or mainnet token configuration is deployed. Create,
contribution, payout, and refund transactions remain gated. Do not enable them for mainnet until
the contract and application readiness gates below are completed.

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

The Base Sepolia Supabase project is provisioned and its migrations are applied. No POT factory is
deployed or configured, and no indexing has run. The verified Circle USDC address is documented
in `TESTNET_WALLET_SETUP.md`; verify token and network configuration from authoritative sources
before deployment. Never invent addresses or secrets.

The event-indexing endpoint also requires a deployed factory, a verified factory start block,
Base Sepolia RPC settings, and the server-side settings documented in `INDEXING.md`. The endpoint is
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

## Additional mainnet readiness gates

- Review and formally audit the Solidity contracts and publish the audit and remediation record.
- Design and test a mainnet-specific deployment and token configuration; do not reuse Base Sepolia
  contract addresses or assume test USDC is equivalent to production USDC.
- Review every chain-specific assumption in the app and data schema. The current Supabase schema
  constrains `chain_id` to `84532`, so mainnet indexing requires a reviewed schema migration and
  explicit multi-environment separation.
- Test deployment, monitoring, indexer recovery, backups, incident response, and wallet flows on
  Base Sepolia before considering any real funds.
- Keep transaction controls disabled until the exact mainnet contract, token, RPC, and Builder Code
  have been independently verified and approved.
