export type SettlementMode = "target" | "flexible";

export type PotDraft = {
  name: string;
  purpose: string;
  mode: SettlementMode;
  target: string;
  deadline: string;
  minimum: string;
};

export function isPositiveAmount(value: string): boolean {
  if (!/^(?:0|[1-9]\d{0,77})(?:\.\d{1,36})?$/.test(value)) return false;
  return value.split(".").some((part) => /[1-9]/.test(part));
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
    errors.push("Enter a minimum contribution greater than zero, with up to 36 decimal places.");
  }

  if (draft.mode === "target") {
    if (!isPositiveAmount(draft.target)) {
      errors.push("Enter a goal greater than zero, with up to 36 decimal places.");
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
