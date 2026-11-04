import { describe, expect, it } from "vitest";
import { canClaimPotRefund, canOrganizerPayout } from "./pot-settlement";

const organizer = "0x1111111111111111111111111111111111111111";
const contributor = "0x2222222222222222222222222222222222222222";
const baseState = {
  walletAddress: organizer,
  organizer,
  paidOut: false,
  payoutEligible: true,
  refundEligible: false,
  contribution: BigInt(5_000_000),
  refundClaimed: false,
};

describe("payout eligibility", () => {
  it("allows only the organizer when payout is eligible and not completed", () => {
    expect(canOrganizerPayout(baseState)).toBe(true);
    expect(canOrganizerPayout({ ...baseState, walletAddress: contributor })).toBe(false);
    expect(canOrganizerPayout({ ...baseState, payoutEligible: false })).toBe(false);
    expect(canOrganizerPayout({ ...baseState, paidOut: true })).toBe(false);
  });

  it("compares wallet and organizer addresses case-insensitively", () => {
    expect(
      canOrganizerPayout({
        ...baseState,
        walletAddress: "0X1111111111111111111111111111111111111111",
      }),
    ).toBe(true);
  });
});

describe("refund eligibility", () => {
  it("allows an eligible contributor to claim once", () => {
    expect(
      canClaimPotRefund({
        ...baseState,
        walletAddress: contributor,
        refundEligible: true,
        payoutEligible: false,
      }),
    ).toBe(true);
  });

  it("rejects refunds without a contribution, after payout, before eligibility, or after claim", () => {
    expect(canClaimPotRefund({ ...baseState, refundEligible: true, contribution: BigInt(0) })).toBe(
      false,
    );
    expect(canClaimPotRefund({ ...baseState, refundEligible: true, paidOut: true })).toBe(false);
    expect(canClaimPotRefund({ ...baseState, refundEligible: false })).toBe(false);
    expect(canClaimPotRefund({ ...baseState, refundEligible: true, refundClaimed: true })).toBe(
      false,
    );
  });
});
