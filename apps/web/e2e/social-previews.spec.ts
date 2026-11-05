import { expect, test } from "@playwright/test";

test("social crawlers receive complete metadata without running JavaScript", async ({
  request,
}) => {
  for (const userAgent of [
    "facebookexternalhit/1.1",
    "Twitterbot/1.0",
    "LinkedInBot/1.0",
    "WhatsApp/2.0",
    "TelegramBot",
    "Discordbot/2.0",
    "Slackbot-LinkExpanding 1.0",
  ]) {
    const response = await request.get("/", {
      headers: { "user-agent": userAgent },
    });
    expect(response.status()).toBe(200);
    const head = (await response.text()).split("</head>")[0];
    for (const property of [
      "og:title",
      "og:description",
      "og:url",
      "og:image",
      "og:image:width",
      "og:image:height",
      "og:site_name",
    ])
      expect(head, `${userAgent}: ${property}`).toContain(
        `property="${property}"`,
      );
    expect(head).toContain('name="twitter:card" content="summary_large_image"');
    expect(head).toContain('name="twitter:image"');
    expect(head).toContain('rel="canonical"');
    expect(head).toContain("Big plans. One shared pot.");
  }
});

test("social images render as public 1200 by 630 PNGs, including unavailable pots", async ({
  request,
}) => {
  for (const path of [
    "/opengraph-image",
    "/pot/0x1111111111111111111111111111111111111111/opengraph-image",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    const png = await response.body();
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  }
});

test("shared routes have their own canonical URLs and safe fallback metadata", async ({
  request,
}) => {
  const response = await request.get(
    "/pot/0x1111111111111111111111111111111111111111",
    { headers: { "user-agent": "WhatsApp/2.0" } },
  );
  const head = (await response.text()).split("</head>")[0];
  expect(head).toContain("A shared pot");
  expect(head).toContain(
    "/pot/0x1111111111111111111111111111111111111111/opengraph-image",
  );
  expect(head).toContain('name="robots" content="noindex, follow"');
  const planner = await request.get("/create", {
    headers: { "user-agent": "Twitterbot/1.0" },
  });
  expect((await planner.text()).split("</head>")[0]).toContain('/create"');
});
