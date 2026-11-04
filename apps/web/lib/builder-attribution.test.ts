import { describe, expect, it } from "vitest";
import {
  getBuilderDataSuffix,
  requireBuilderDataSuffix,
} from "./builder-attribution";

describe("Builder Code attribution", () => {
  it("does not configure attribution when no Builder Code is supplied", () => {
    expect(getBuilderDataSuffix("")).toBeUndefined();
    expect(getBuilderDataSuffix("   ")).toBeUndefined();
  });

  it("fails closed for Builder Codes that exceed the ERC-8021 length limit", () => {
    expect(getBuilderDataSuffix("A".repeat(256))).toBeUndefined();
    expect(() => requireBuilderDataSuffix("A".repeat(256))).toThrow(
      "Base transactions are disabled until NEXT_PUBLIC_BASE_BUILDER_CODE contains a valid Builder Code of 255 bytes or fewer.",
    );
  });

  it("creates an ERC-8021 suffix from a configured public Builder Code", () => {
    const suffix = getBuilderDataSuffix("POT-TEST-CODE");

    expect(suffix).toMatch(/^0x[\da-f]+8021(?:8021)+$/i);
  });

  it("fails closed when a transaction requires attribution but no code is configured", () => {
    expect(() => requireBuilderDataSuffix("")).toThrow(
      "Base transactions are disabled until NEXT_PUBLIC_BASE_BUILDER_CODE contains a valid Builder Code of 255 bytes or fewer.",
    );
  });

  it("returns attribution when configured for a transaction", () => {
    expect(requireBuilderDataSuffix("POT-TEST-CODE")).toBe(getBuilderDataSuffix("POT-TEST-CODE"));
  });
});
