import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPotPageMetadata, getPotSocialPreview } from "./pot-social";

const mocks = vi.hoisted(() => ({ getPublicPot: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./public-pot", () => ({ getPublicPot: mocks.getPublicPot }));
beforeEach(() => vi.clearAllMocks());

describe("pot social privacy", () => {
  it("uses only public pot details in social metadata", async () => {
    mocks.getPublicPot.mockResolvedValue({
      name: "The shared trip",
      description: "Our weekend plan",
      isPublic: true,
    });
    const result = await getPotPageMetadata(
      "0x1111111111111111111111111111111111111111",
    );
    expect(result.title).toBe("The shared trip");
    expect(result.description).toBe("Our weekend plan");
    expect(result.robots).toMatchObject({ index: true });
    expect(mocks.getPublicPot).toHaveBeenCalledWith(
      "0x1111111111111111111111111111111111111111",
    );
  });

  it("never discloses a private pot name or description", async () => {
    mocks.getPublicPot.mockResolvedValue({
      name: "Private name",
      description: "Private purpose",
      isPublic: false,
    });
    const result = await getPotPageMetadata(
      "0x1111111111111111111111111111111111111111",
    );
    expect(result.title).toBe("A shared pot");
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(result.robots).toMatchObject({ index: false });
  });

  it("returns a branded fallback when services are unavailable", async () => {
    mocks.getPublicPot.mockRejectedValue(new Error("Missing settings"));
    expect(await getPotSocialPreview("missing")).toBeNull();
    expect((await getPotPageMetadata("missing")).title).toBe("A shared pot");
  });
});
