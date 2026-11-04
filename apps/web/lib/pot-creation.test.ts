import { describe, expect, it } from "vitest";
import {
  compareAmounts,
  getCrowdfundingCreateArguments,
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
  payoutRecipient: "",
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
      "Choose a deadline for this pot.",
    );
    expect(
      validatePotDraft({ ...validTargetDraft, deadline: new Date(now).toISOString() }, now),
    ).toContain("Choose a deadline in the future.");
  });

  it("rejects new pots using the retired organizer-decides rule", () => {
    expect(
      validatePotDraft(
        { ...validTargetDraft, mode: "flexible", target: "", deadline: "" },
        now,
      ),
    ).toContain(
      "The organizer-decides rule is no longer available for new pots. Choose a goal-based or crowdfunding rule.",
    );
  });

  it.each(["crowdfunding-deadline", "crowdfunding-anytime"] as const)(
    "requires a valid recipient for %s crowdfunding",
    (mode) => {
      const campaignDraft: PotDraft = {
        ...validTargetDraft,
        mode,
        payoutRecipient: "not-an-address",
      };

      expect(validatePotDraft(campaignDraft, now)).toContain(
        "Enter a valid approved payout wallet address.",
      );
      expect(
        validatePotDraft(
          { ...campaignDraft, payoutRecipient: "0x1111111111111111111111111111111111111111" },
          now,
        ),
      ).toEqual([]);
    },
  );

  it("encodes USDC values in six-decimal base units for goal-based pots", () => {
    expect(getPotFactoryCreateArguments(validTargetDraft, now)).toEqual([
      "Group trip",
      "",
      true,
      BigInt(250_000_000),
      BigInt(Math.floor(new Date(validTargetDraft.deadline).getTime() / 1000)),
      BigInt(1_000_000),
    ]);

    expect(() =>
      getPotFactoryCreateArguments(
        { ...validTargetDraft, mode: "flexible", target: "", deadline: "" },
        now,
      ),
    ).toThrow("Choose a supported pot rule before creating a standard pot.");
  });

  it("encodes the two crowdfunding payout rules and the approved recipient", () => {
    const payoutRecipient = "0x1111111111111111111111111111111111111111";
    const deadlineDraft: PotDraft = {
      ...validTargetDraft,
      mode: "crowdfunding-deadline",
      payoutRecipient,
    };
    const anytimeDraft: PotDraft = {
      ...validTargetDraft,
      mode: "crowdfunding-anytime",
      payoutRecipient,
    };

    expect(getCrowdfundingCreateArguments(deadlineDraft, now)).toEqual([
      "Group trip",
      "",
      2,
      BigInt(250_000_000),
      BigInt(Math.floor(new Date(validTargetDraft.deadline).getTime() / 1000)),
      BigInt(1_000_000),
      payoutRecipient,
    ]);
    expect(getCrowdfundingCreateArguments(anytimeDraft, now)[2]).toBe(3);
  });

  it("counts purpose text by Unicode code points", () => {
    expect(
      validatePotDraft({ ...validTargetDraft, purpose: "🎉".repeat(2001) }, now),
    ).toContain("The purpose must be 2,000 characters or fewer.");
  });
});
