import { expect, test } from "@playwright/test";

test("landing page routes visitors to pot planning", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Make a plan/ })).toBeVisible();
  await expect(page.getByText("No live payments", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Plan a pot" }).first().click();

  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByRole("heading", { name: "Set the rules before you share." })).toBeVisible();
});

test("validates goal rules and previews a flexible pot", async ({ page }) => {
  await page.goto("/create");
  await page.getByRole("button", { name: "Preview pot rules" }).click();

  const alert = page.locator(".pot-form-errors");
  await expect(alert).toContainText("Enter a name for your pot.");
  await expect(alert).toContainText("Enter a minimum contribution");
  await expect(alert).toContainText("Enter a goal greater than zero");
  await expect(alert).toContainText("Choose a deadline for a goal-based pot.");

  await page.getByLabel("Pot name").fill("Community trip");
  await page.getByLabel("What is this pot for? (optional)").fill("A weekend away together.");
  await page.getByLabel("Funding goal").fill("250");
  await page.getByLabel("Minimum contribution").fill("5");
  const futureDeadline = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
  await page.locator("#pot-deadline").fill(futureDeadline);
  await page.getByRole("button", { name: "Preview pot rules" }).click();

  const preview = page.locator(".pot-create-preview");
  await expect(preview.getByRole("heading", { name: "Community trip" })).toBeVisible();
  await expect(preview).toContainText("250");
  await expect(preview).toContainText("A weekend away together.");
  await expect(alert).toHaveCount(0);

  await page.getByRole("radio", { name: /Flexible/ }).check();
  await expect(page.getByLabel("Funding goal")).toHaveCount(0);
  await expect(page.locator("#pot-deadline")).toHaveCount(0);
  await page.getByRole("button", { name: "Preview pot rules" }).click();
  await expect(preview).toContainText("Flexible");
  await expect(preview).not.toContainText("Funding goal");
});

test("restores and clears a saved local draft only after confirmation", async ({ page }) => {
  await page.goto("/create");
  await page.getByLabel("Pot name").fill("Saved trip");
  await page.getByLabel("Minimum contribution").fill("2");
  await page.getByRole("button", { name: "Save draft on this device" }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved in this browser");

  await page.getByLabel("Pot name").fill("Unsaved replacement");
  await page.getByRole("button", { name: "Restore saved draft" }).click();
  const confirmation = page.getByRole("group", { name: "Confirm local draft action" });
  await expect(confirmation).toContainText("Restoring will replace the values currently in the form.");
  await confirmation.getByRole("button", { name: "Replace form values" }).click();
  await expect(page.getByLabel("Pot name")).toHaveValue("Saved trip");

  await page.locator(".pot-draft-actions").getByRole("button", { name: "Clear saved draft" }).click();
  await expect(confirmation).toContainText("Remove the saved draft from this device?");
  await confirmation.getByRole("button", { name: "Clear saved draft" }).click();
  await expect(page.getByRole("status")).toContainText("Saved draft removed from this browser");
});

test("landing and planning layouts fit the mobile viewport", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Responsive overflow assertion is for mobile Chromium.");

  for (const route of ["/", "/create"]) {
    await page.goto(route);
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  }
});
