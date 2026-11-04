# Contract rules and test instructions

## Status

`contracts/src/PotFactory.sol` and `contracts/src/Pot.sol` implement an initial testable contract
design. The contracts have not been deployed or audited. The included ERC-20 is a local test
mock, not the official Base Sepolia USDC contract.

## Settlement rules

The factory has one immutable ERC-20 settlement token. Each pot stores its organizer and rules.
There is no admin role, upgrade path, arbitrary token selector, or privileged withdrawal.
The intended Base Sepolia test asset is Circle-issued USDC at
`0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals), verified against the official Circle
contract-address list and live Base Sepolia RPC. This is a testnet asset, not a mainnet token.

### Goal with refunds (funding mode 0)

- The target must be greater than zero and the deadline must be in the future at creation.
- The minimum contribution must be nonzero and cannot exceed the target.
- The minimum applies to each contribution except the exact remaining amount needed to reach the
  target, so a partially funded pot cannot be left short solely because its remaining balance is
  below the minimum.
- Contributions stop at the deadline or when the target is exactly reached.
- Contributions that would exceed the target are rejected.
- The organizer can pay out once the target is reached, including after the deadline.
- If the deadline is reached below target, each contributor can claim their full aggregated
  contribution once. No automatic refund is implied; each contributor must call `claimRefund`.

### Crowdfunding to a deadline (funding mode 2)

- The target and deadline are required. The target is a soft goal; contributions can exceed it and
  remain open until the deadline.
- The organizer names an immutable, nonzero payout wallet at creation. Contributors can inspect
  this address before contributing, and only that wallet can call `payout`.
- The named wallet can withdraw after the deadline, whether or not the target was reached. A missed
  target never makes contributions refundable.
- Funds are not transferred automatically: the payout wallet must submit a transaction.

### Crowdfunding with early withdrawals (funding mode 3)

- The target and deadline are required. The target is a soft goal; contributions can exceed it and
  remain open until the deadline.
- The named payout wallet can withdraw the entire current balance at any time. It can withdraw
  again if more contributions arrive before the deadline closes the campaign.
- Contributions are not refundable, including after the deadline.
- The payout wallet cannot be changed after creation.

The new factory rejects the previous organizer-decides mode. Existing deployments are immutable;
any older organizer-decides pots keep the rules enforced by their original contracts.

All contribution amounts and target values are raw ERC-20 base units. The contract does not assume
or hard-code token decimals; the app must use the configured token's verified decimals when
formatting user amounts. Contribution accounting rejects fee-on-transfer tokens.

Direct ERC-20 transfers to a pot bypass `contribute`, are not recorded, and cannot be recovered by
an organizer. The application must direct users through the contract contribution flow and must
not advertise a pot contract address as a payment address.

## Testing

Requirements: Node.js/npm and a supported Foundry binary installed by npm.

```powershell
cd contracts
npm install
npm test
npm run build
npm run fmt:check
```

Tests cover pot configuration, crowdfunding payout timing and authorization, contributions, token
selection, deadline and target boundaries, payout replay prevention, contributor refunds,
fee-on-transfer rejection, and state rollback when token transfers fail.

## Deployment gate

Before testnet deployment, verify the token code and metadata on chain and review all deployment
constructor parameters. Builder Code attribution must be configured before any deployment
transaction. Before any mainnet use, require independent security review; passing this test suite
is not an audit or a safety guarantee.
