import { describe, expect, it } from "vitest";
import {
  formatUsdcBaseUnits,
  parseUsdcContribution,
  validateContribution,
} from "./pot-contribution";

describe("USDC contribution amount parsing", () => {
  it("parses exact six-decimal amounts without floating-point conversion", () => {
    expect(parseUsdcContribution("1")).toBe(BigInt(1_000_000));
    expect(parseUsdcContribution("0.000001")).toBe(BigInt(1));
    expect(parseUsdcContribution("900719925474099300.123456")).toBe(
      BigInt("900719925474099300123456"),
    );
  });

  it.each(["", "0", "0.000000", "-1", "01", ".5", "1.", "1e2", "1.0000001"])(
    "rejects invalid amount %s",
    (value) => {
      expect(parseUsdcContribution(value)).toBeUndefined();
    },
  );

  it("formats base units for wallet suggestions", () => {
    expect(formatUsdcBaseUnits(BigInt(1_250_000))).toBe("1.25");
    expect(formatUsdcBaseUnits(BigInt(1_000_001))).toBe("1.000001");
    expect(formatUsdcBaseUnits(BigInt(1_000_000))).toBe("1");
  });
});

describe("contribution rule validation", () => {
  const rules = {
    minimum: BigInt(2_000_000),
    targetBased: true,
    target: BigInt(100_000_000),
    totalContributed: BigInt(50_000_000),
    balance: BigInt(200_000_000),
  };

  it("accepts a contribution meeting the minimum and within the remaining goal", () => {
    expect(validateContribution(BigInt(5_000_000), rules)).toEqual([]);
  });

  it("allows the exact remaining goal even when it is below the minimum", () => {
    expect(
      validateContribution(BigInt(500_000), {
        ...rules,
        totalContributed: BigInt(99_500_000),
      }),
    ).toEqual([]);
  });

  it("rejects amounts below the minimum or above the remaining goal", () => {
    expect(validateContribution(BigInt(1_000_000), rules)).toContain(
      "The contribution is below this pot’s minimum.",
    );
    expect(validateContribution(BigInt(50_000_001), rules)).toContain(
      "The contribution cannot exceed the remaining amount needed to reach the goal.",
    );
  });

  it("checks balance and permits flexible pots without a goal cap", () => {
    expect(validateContribution(BigInt(3_000_000), { ...rules, balance: BigInt(1) })).toContain(
      "Your USDC balance is too low for this contribution.",
    );
    expect(
      validateContribution(BigInt(150_000_000), {
        ...rules,
        targetBased: false,
        target: BigInt(0),
        totalContributed: BigInt(0),
      }),
    ).toEqual([]);
  });

  it("rejects contributions after the target is already reached", () => {
    expect(
      validateContribution(BigInt(1), {
        ...rules,
        totalContributed: rules.target,
      }),
    ).toContain("This pot has reached its funding goal.");
  });
});
