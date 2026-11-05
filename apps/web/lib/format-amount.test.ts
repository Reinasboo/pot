import { describe, expect, it } from "vitest";
import { formatDisplayAmount } from "./format-amount";

describe("financial display amounts", () => {
  it("does not display small non-zero contributions as zero", () => {
    expect(formatDisplayAmount("1")).toBe("0.000001 USDC");
    expect(formatDisplayAmount("9999")).toBe("0.009999 USDC");
  });
  it("groups large numbers without floating-point precision loss", () => {
    expect(formatDisplayAmount("9007199254740993123456")).toBe(
      "9,007,199,254,740,993.123456 USDC",
    );
  });
  it("handles zero and whole amounts without extra decimals", () => {
    expect(formatDisplayAmount("0")).toBe("0 USDC");
    expect(formatDisplayAmount("25000000")).toBe("25 USDC");
  });
});
