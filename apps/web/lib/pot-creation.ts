import { parseUnits } from "viem";

export type SettlementMode = "target" | "flexible";
export const SETTLEMENT_TOKEN_DECIMALS = 6;

const UINT256_MAX = (BigInt(1) << BigInt(256)) - BigInt(1);

export type PotDraft = {
  name: string;
  purpose: string;
  mode: SettlementMode;
  target: string;
  deadline: string;
  minimum: string;
};

export function isPositiveAmount(value: string): boolean {
  if (!/^(?:0|[1-9]\d{0,77})(?:\.\d{1,6})?$/.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  const baseUnits = BigInt(`${whole}${fraction.padEnd(SETTLEMENT_TOKEN_DECIMALS, "0")}`);
  return baseUnits > BigInt(0) && baseUnits <= UINT256_MAX;
}

export function compareAmounts(left: string, right: string): number {
  const [leftWhole, leftFraction = ""] = left.split(".");
  const [rightWhole, rightFraction = ""] = right.split(".");
  const normalizedLeft = leftWhole.replace(/^0+(?=\d)/, "");
  const normalizedRight = rightWhole.replace(/^0+(?=\d)/, "");

  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length > normalizedRight.length ? 1 : -1;
  }
  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft > normalizedRight ? 1 : -1;
  }

  const fractionLength = Math.max(leftFraction.length, rightFraction.length);
  const paddedLeft = leftFraction.padEnd(fractionLength, "0");
  const paddedRight = rightFraction.padEnd(fractionLength, "0");
  if (paddedLeft === paddedRight) return 0;
  return paddedLeft > paddedRight ? 1 : -1;
}

export function validatePotDraft(draft: PotDraft, now = Date.now()): string[] {
  const errors: string[] = [];
  const name = draft.name.trim();
  if (!name) errors.push("Enter a name for your pot.");
  else if (new TextEncoder().encode(name).length > 80) {
    errors.push("The name must be 80 UTF-8 bytes or fewer.");
  }
  if (Array.from(draft.purpose).length > 2000) {
    errors.push("The purpose must be 2,000 characters or fewer.");
  }

  if (!isPositiveAmount(draft.minimum)) {
    errors.push("Enter a minimum contribution greater than zero, with up to 6 decimal places.");
  }

  if (draft.mode === "target") {
    if (!isPositiveAmount(draft.target)) {
      errors.push("Enter a goal greater than zero, with up to 6 decimal places.");
    }
    if (
      isPositiveAmount(draft.target) &&
      isPositiveAmount(draft.minimum) &&
      compareAmounts(draft.minimum, draft.target) > 0
    ) {
      errors.push("The minimum contribution cannot be greater than the goal.");
    }
    if (!draft.deadline) {
      errors.push("Choose a deadline for a goal-based pot.");
    } else {
      const deadline = new Date(draft.deadline);
      if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= now) {
        errors.push("Choose a deadline in the future.");
      }
    }
  }

  return errors;
}

export function getPotFactoryCreateArguments(
  draft: PotDraft,
  now = Date.now(),
): readonly [string, string, boolean, bigint, bigint, bigint] {
  const errors = validatePotDraft(draft, now);
  if (errors.length > 0) throw new Error(errors.join(" "));

  const targetBased = draft.mode === "target";
  const deadlineSeconds = targetBased
    ? BigInt(Math.floor(new Date(draft.deadline).getTime() / 1000))
    : BigInt(0);
  if (deadlineSeconds >= (BigInt(1) << BigInt(64))) {
    throw new Error("The pot deadline exceeds the contract's supported range.");
  }

  return [
    draft.name.trim(),
    "",
    targetBased,
    targetBased ? parseUnits(draft.target, SETTLEMENT_TOKEN_DECIMALS) : BigInt(0),
    deadlineSeconds,
    parseUnits(draft.minimum, SETTLEMENT_TOKEN_DECIMALS),
  ];
}
