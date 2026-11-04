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

  it("creates an ERC-8021 suffix from a configured public Builder Code", () => {
    const suffix = getBuilderDataSuffix("POT-TEST-CODE");

    expect(suffix).toMatch(/^0x[\da-f]+8021(?:8021)+$/i);
  });

  it("fails closed when a transaction requires attribution but no code is configured", () => {
    expect(() => requireBuilderDataSuffix("")).toThrow(
      "Base transactions are disabled until NEXT_PUBLIC_BASE_BUILDER_CODE is configured.",
    );
  });

  it("returns attribution when configured for a transaction", () => {
    expect(requireBuilderDataSuffix("POT-TEST-CODE")).toBe(getBuilderDataSuffix("POT-TEST-CODE"));
  });
});
