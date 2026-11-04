import { SETTLEMENT_TOKEN_DECIMALS } from "./pot-creation";

const UINT256_MAX = (BigInt(1) << BigInt(256)) - BigInt(1);
const USDC_BASE_UNIT = BigInt(10) ** BigInt(SETTLEMENT_TOKEN_DECIMALS);

export type ContributionRules = {
  minimum: bigint;
  targetBased: boolean;
  target: bigint;
  totalContributed: bigint;
  balance: bigint;
};

export function parseUsdcContribution(value: string): bigint | undefined {
  const decimals = SETTLEMENT_TOKEN_DECIMALS;
  if (!new RegExp(`^(?:0|[1-9]\\d{0,77})(?:\\.\\d{1,${decimals}})?$`).test(value)) {
    return undefined;
  }
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(`${whole}${fraction.padEnd(decimals, "0")}`);
  return amount > BigInt(0) && amount <= UINT256_MAX ? amount : undefined;
}

export function validateContribution(
  amount: bigint,
  rules: ContributionRules,
): string[] {
  const errors: string[] = [];
  if (amount <= BigInt(0) || amount > UINT256_MAX) {
    return ["Enter a contribution greater than zero."];
  }

  const remaining = rules.targetBased
    ? rules.target > rules.totalContributed
      ? rules.target - rules.totalContributed
      : BigInt(0)
    : undefined;

  if (remaining === BigInt(0)) {
    errors.push("This pot has reached its funding goal.");
  } else if (remaining !== undefined && amount > remaining) {
    errors.push("The contribution cannot exceed the remaining amount needed to reach the goal.");
  } else if (amount < rules.minimum && amount !== remaining) {
    errors.push("The contribution is below this pot’s minimum.");
  }

  if (amount > rules.balance) {
    errors.push("Your USDC balance is too low for this contribution.");
  }

  return errors;
}

export function formatUsdcBaseUnits(amount: bigint): string {
  const whole = amount / USDC_BASE_UNIT;
  const fraction = String(amount % USDC_BASE_UNIT)
    .padStart(SETTLEMENT_TOKEN_DECIMALS, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
