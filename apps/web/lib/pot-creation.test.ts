import { describe, expect, it } from "vitest";
import {
  compareAmounts,
  getPotFactoryCreateArguments,
  isPositiveAmount,
  validatePotDraft,
  type PotDraft,
} from "./pot-creation";

const now = Date.UTC(2030, 0, 1);
const uint256Max = (BigInt(1) << BigInt(256)) - BigInt(1);
const formatUsdcBaseUnits = (baseUnits: bigint) =>
  `${baseUnits / BigInt(1_000_000)}.${String(baseUnits % BigInt(1_000_000)).padStart(6, "0")}`;
const validTargetDraft: PotDraft = {
  name: "Group trip",
  purpose: "A shared trip",
  mode: "target",
  target: "250.00",
  deadline: "2030-01-02T00:00",
  minimum: "1",
};

describe("isPositiveAmount", () => {
  it("accepts positive decimal amounts up to the supported precision", () => {
    expect(isPositiveAmount("0.000001")).toBe(true);
    expect(isPositiveAmount("900719925474099300.123456")).toBe(true);
    expect(isPositiveAmount(formatUsdcBaseUnits(uint256Max))).toBe(true);
    expect(isPositiveAmount(formatUsdcBaseUnits(uint256Max + BigInt(1)))).toBe(false);
  });

  it.each([
    "0",
    "0.000000",
    "-1",
    "01",
    "1.",
    ".5",
    "1e2",
    "1.0000001",
    "9".repeat(78),
  ])(
    "rejects invalid or non-positive amount %s",
    (amount) => {
      expect(isPositiveAmount(amount)).toBe(false);
    },
  );
});

describe("compareAmounts", () => {
  it("compares whole and fractional values without converting to floating point", () => {
    expect(compareAmounts("900719925474099300", "900719925474099299.99")).toBe(1);
    expect(compareAmounts("1.020", "1.02")).toBe(0);
    expect(compareAmounts("0.9", "1")).toBe(-1);
    expect(compareAmounts("12.001", "12.01")).toBe(-1);
  });
});

describe("validatePotDraft", () => {
  it("accepts a valid target pot with a future deadline", () => {
    expect(validatePotDraft(validTargetDraft, now)).toEqual([]);
  });

  it("measures pot names by UTF-8 bytes", () => {
    expect(validatePotDraft({ ...validTargetDraft, name: "🎉".repeat(20) }, now)).toEqual([]);
    expect(validatePotDraft({ ...validTargetDraft, name: "🎉".repeat(21) }, now)).toContain(
      "The name must be 80 UTF-8 bytes or fewer.",
    );
  });

  it("rejects a minimum contribution larger than the target", () => {
    expect(
      validatePotDraft({ ...validTargetDraft, target: "10", minimum: "10.0001" }, now),
    ).toContain("The minimum contribution cannot be greater than the goal.");
  });

  it("requires a strictly future deadline for target pots", () => {
    expect(validatePotDraft({ ...validTargetDraft, deadline: "" }, now)).toContain(
      "Choose a deadline for a goal-based pot.",
    );
    expect(
      validatePotDraft({ ...validTargetDraft, deadline: new Date(now).toISOString() }, now),
    ).toContain("Choose a deadline in the future.");
  });

  it("does not require a target or deadline for flexible pots", () => {
    expect(
      validatePotDraft(
        { ...validTargetDraft, mode: "flexible", target: "", deadline: "" },
        now,
      ),
    ).toEqual([]);
  });

  it("encodes USDC values in six-decimal base units and clears flexible target rules", () => {
    expect(getPotFactoryCreateArguments(validTargetDraft, now)).toEqual([
      "Group trip",
      "",
      true,
      BigInt(250_000_000),
      BigInt(Math.floor(new Date(validTargetDraft.deadline).getTime() / 1000)),
      BigInt(1_000_000),
    ]);

    expect(
      getPotFactoryCreateArguments(
        { ...validTargetDraft, mode: "flexible", target: "", deadline: "" },
        now,
      ),
    ).toEqual([
      "Group trip",
      "",
      false,
      BigInt(0),
      BigInt(0),
      BigInt(1_000_000),
    ]);
  });

  it("counts purpose text by Unicode code points", () => {
    expect(
      validatePotDraft({ ...validTargetDraft, purpose: "🎉".repeat(2001) }, now),
    ).toContain("The purpose must be 2,000 characters or fewer.");
  });
});
