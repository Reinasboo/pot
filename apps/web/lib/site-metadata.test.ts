import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl, pageMetadata } from "./site-metadata";

afterEach(() => vi.unstubAllEnvs());

describe("social metadata", () => {
  it("creates absolute, canonical page and large-image card URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pot.example/");
    const metadata = pageMetadata({
      title: "A shared pot",
      description: "Money rules",
      path: "/create",
    });
    expect(metadata.alternates?.canonical).toBe("https://pot.example/create");
    expect(metadata.openGraph).toMatchObject({
      url: "https://pot.example/create",
      siteName: "POT",
      images: [
        {
          url: "https://pot.example/opengraph-image",
          width: 1200,
          height: 630,
          type: "image/png",
        },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [{ url: "https://pot.example/opengraph-image" }],
    });
  });

  it("rejects unsafe deployment origins", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://pot.example");
    expect(getSiteUrl).toThrow(/HTTPS/);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://secret:password@pot.example");
    expect(getSiteUrl).toThrow(/credentials/);
  });
});
