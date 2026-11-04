# Contract rules and test instructions

## Status

`contracts/src/PotFactory.sol` and `contracts/src/Pot.sol` implement an initial testable contract
design. The contracts have not been deployed or audited. The included ERC-20 is a local test
mock, not the official Base Sepolia USDC contract.

## Settlement rules

The factory has one immutable ERC-20 settlement token. Each pot stores its organizer and rules.
There is no admin role, upgrade path, arbitrary token selector, or privileged withdrawal.

### Flexible pot

- The target and deadline must both be zero.
- Contributions stay open until the organizer pays out.
- The organizer can pay out all accounted contributions once there is at least one contribution.
- Contributors cannot claim refunds from this mode.

### Target pot

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

Tests cover pot configuration, contributions, token selection, deadline and target boundaries,
payout authorization and replay prevention, contributor refunds, fee-on-transfer rejection, and
state rollback when token transfers fail.

## Deployment gate

Before testnet deployment, verify the configured token address from an authoritative source and
review all deployment constructor parameters. Before any mainnet use, require independent security
review; passing this test suite is not an audit or a safety guarantee.
