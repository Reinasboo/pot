import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("an example becomes an editable plan without inventing payment activity", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "A gift", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "A gift", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "One thoughtful gift. From all of us." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Plan a group gift" }).click();
  await expect(page.getByLabel("Pot name")).toHaveValue(
    "The birthday surprise",
  );
  await expect(page.getByLabel("Funding goal")).toHaveValue("180");
  await page
    .locator("#pot-deadline")
    .fill(new Date(Date.now() + 172800000).toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Preview this plan" }).click();
  await expect(page.locator(".pot-create-preview")).toBeFocused();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download plan" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pot-plan.txt");
  const path = await download.path();
  const content = await readFile(path!, "utf8");
  expect(content).toContain("POT plan: The birthday surprise");
  expect(content).toContain("Goal: 180 USDC");
  expect(content).toContain("Refunds are not automatic");
  expect(content).toContain("not a payment request");
});

test("validation brings keyboard focus to errors and rejects a zero payout wallet", async ({
  page,
}) => {
  await page.goto("/create");
  await page.getByRole("button", { name: "Preview this plan" }).click();
  await expect(page.locator(".pot-form-errors")).toBeFocused();
  await page
    .getByRole("radio", { name: /Crowdfund until the deadline/ })
    .check();
  await page.getByLabel("Approved payout wallet").fill(`0x${"0".repeat(40)}`);
  await page.getByRole("button", { name: "Preview this plan" }).click();
  await expect(page.locator(".pot-form-errors")).toContainText(
    "Enter a valid approved payout wallet address.",
  );
});

test("unconfigured discovery offers a usable next step", async ({ page }) => {
  await page.route("**/api/pots/discover?*", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Public pot data is not configured yet." },
    }),
  );
  await page.goto("/discover");
  await expect(
    page.getByRole("heading", { name: "Public pots aren’t available yet" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Plan a pot" }).click();
  await expect(page).toHaveURL(/\/create$/);
});

test("mobile navigation reaches the dashboard", async ({ page, isMobile }) => {
  test.skip(
    !isMobile,
    "Mobile navigation is shown below the desktop breakpoint.",
  );
  await page.goto("/");
  await page.getByLabel("Open navigation").click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "My pots" })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("all entry screens fit a narrow phone and unknown routes recover", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const path of [
    "/",
    "/create",
    "/connect",
    "/dashboard",
    "/discover",
    "/roadmap",
  ]) {
    await page.goto(path);
    const overflowing = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflowing, `${path} should fit a 320px screen`).toBe(false);
  }
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This link leads to an empty pot." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to POT" }).click();
  await expect(page).toHaveURL("/");
});
