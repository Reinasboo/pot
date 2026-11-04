# Base Sepolia test wallets

This guide prepares two dedicated wallets for an organizer/contributor test. It does not enable
POT transactions: the factory is not deployed, and Builder Code attribution has not been
configured. The preflight script only reads public chain data and never signs or sends transactions.

## Create two test-only accounts

1. Use a wallet provider supported by the app, such as Coinbase Wallet or an injected EVM wallet.
2. Create two fresh accounts specifically for Base Sepolia testing: one organizer and one
   contributor. Keep them separate from any account that holds real assets.
3. Use separate browser profiles/devices for the two roles when testing the dapp. This avoids
   accidentally contributing from the organizer account.
4. Keep recovery phrases and private keys in the wallet's secure backup. Never paste them into
   chat, `.env.local`, source files, or a terminal command.
5. Record only the public `0x...` address for each role.

## Add Base Sepolia and fund the accounts

Use the wallet network switcher or add this network:

| Setting | Value |
|---|---|
| Network | Base Sepolia |
| Chain ID | `84532` |
| Currency | `ETH` |
| RPC | `https://sepolia.base.org` |
| Explorer | <https://sepolia.basescan.org> |

- Request a small amount of Base Sepolia ETH for gas from the
  [Coinbase Developer Platform faucet](https://portal.cdp.coinbase.com/products/faucet).
- Request test USDC on Base Sepolia from the
  [Circle testnet faucet](https://faucet.circle.com/).
- The official Circle USDC contract for Base Sepolia is
  [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://developers.circle.com/stablecoins/usdc-contract-addresses).
  It was verified against Base Sepolia RPC: chain ID `84532`, contract bytecode present, symbol
  `USDC`, and 6 decimals. Testnet tokens have no mainnet value.

## Run the read-only wallet preflight

From `apps/web`:

```powershell
Copy-Item .env.example .env.local
```

Set `POT_TEST_ORGANIZER_ADDRESS` and `POT_TEST_CONTRIBUTOR_ADDRESS` in `.env.local` to the two
public addresses. Do not enter private keys or seed phrases. Then run:

```powershell
npm run check:testnet
```

The script checks the RPC chain ID, verifies the Circle USDC contract and metadata, and reports
each wallet's ETH and USDC balances. It exits with an error if the addresses are invalid/equal, the
network or token doesn't match, or either wallet lacks a positive balance of either asset. This
read-only check cannot prove that an address is controlled by a signing wallet; connect each
account manually at `/connect` and confirm its public address in the wallet before testing.
RPC URLs must use HTTPS and cannot include URL username/password credentials. RPC URLs containing
provider keys in the query or path are accepted for this local read-only check; failure messages
redact the configured URL.

## Before live POT transactions

The following are still required before deploying or sending a transaction:

- Obtain a Builder Code in [Base developer settings](https://base.dev/) and wire ERC-8021
  attribution into the Wagmi transaction client. Do not send un-attributed Base transactions.
- Review the deployment parameters and deploy the factory using a funded test-only deployer.
- Configure and verify the deployed factory address and deployment block.
- Implement the pot creation, USDC approval/contribution, payout, and refund flows; none is
  currently submitted by the app.
- Test from the organizer and contributor browser profiles and verify every transaction on
  Base Sepolia explorer.

The wallet keys remain inside the wallet provider. The app only needs wallet connection approval
and transaction confirmation from the user when transaction flows are eventually enabled.

Playwright also tests the connect, unsupported-network recovery, and disconnect screens using a
mock injected wallet. This is UI coverage only and does not prove a real wallet provider works or
send a blockchain transaction.
