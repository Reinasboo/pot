# Security

## Current status

There are no deployed POT contracts, wallet transaction flows, configured Supabase project, or
live financial activity. The landing page contains no contribution totals or contributor activity;
its settlement explainer describes intended contract rules only. Initial factory and pot
contracts and an event-indexer implementation exist locally and have tests/build checks, but no
security audit has been performed; neither the contracts nor product may be described as audited
or guaranteed safe.

## Contract requirements

Before any real funds are involved:

- Use safe ERC-20 transfer operations and explicitly handle token decimals.
- Apply reentrancy protection and checks-effects-interactions.
- Validate all configuration, state transitions, and authorization paths.
- Prevent duplicate payouts and refunds.
- Ensure contributors can only claim their correct refundable amount once.
- Keep any administrative capability from bypassing the disclosed settlement rules.
- Test unauthorized calls, boundary conditions, failed transfers, and unusual state transitions
  with Foundry.
- Do not deploy to mainnet before the contracts, token configuration, financial rules, tests, and
  security review are satisfactory.

## Application and infrastructure requirements

- Never store private keys in the application or database.
- Never expose a Supabase service-role key or RPC provider secret to client code.
- Treat user input as untrusted and validate it server-side where applicable.
- Enforce Supabase Row Level Security for private and organizer-only data.
- Verify the active chain before signing or sending transactions.
- Simulate transactions where supported and surface rejected, pending, failed, and confirmed
  states distinctly.
- Never count an unconfirmed transaction as funded money.

## Review gate

Complete contract tests and a security review before a mainnet deployment. A testnet demonstration
is the appropriate initial target.
