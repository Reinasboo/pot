import { expect, test } from "@playwright/test";

test("landing page routes visitors to pot planning", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Make a plan/ })).toBeVisible();
  await expect(page.getByText("No live payments", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Roadmap" })).toHaveAttribute("href", "/roadmap");
  await page.getByRole("link", { name: "Plan a pot" }).first().click();

  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByRole("heading", { name: "Set the rules before you share." })).toBeVisible();
});

test("roadmap is directly accessible and labels gated MVP work", async ({ page }) => {
  await page.goto("/roadmap");

  await expect(page.getByRole("heading", { name: "Where POT is headed." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Core payments" })).toBeVisible();
  await expect(page.getByText("Deployment, attribution, and two-wallet testing remain")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  await page.locator("header").getByRole("link", { name: "Plan a pot" }).click();
  await expect(page).toHaveURL(/\/create$/);
});

test("wallet onboarding explains safe Base Sepolia test setup", async ({ page }) => {
  await page.goto("/connect");

  await expect(page.getByRole("heading", { name: "Connect your wallet." })).toBeVisible();
  await expect(page.getByText("Base Sepolia", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preparing two-wallet tests?" })).toBeVisible();
  await expect(page.getByText(/live pot transactions are not enabled yet/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Circle USDC testnet faucet" })).toHaveAttribute(
    "href",
    "https://faucet.circle.com/",
  );
});

test("connects an injected wallet, recovers from wrong network, and disconnects", async ({
  page,
}) => {
  const walletAddress = "0x1234567890123456789012345678901234567890";
  await page.addInitScript(
    ({ address, initialChainId }) => {
      let chainId = initialChainId;
      let authorized = false;
      const listeners = new Map<string, Set<(value: string) => void>>();

      const provider = {
        isMetaMask: true,
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          if (method === "eth_chainId") return chainId;
          if (method === "eth_accounts") return authorized ? [address] : [];
          if (method === "eth_requestAccounts") {
            authorized = true;
            return [address];
          }
          if (method === "wallet_switchEthereumChain") {
            const requestedChain = params?.[0] as { chainId?: string } | undefined;
            if (!requestedChain?.chainId) throw new Error("Missing requested chain ID");
            chainId = requestedChain.chainId;
            for (const listener of listeners.get("chainChanged") ?? []) listener(chainId);
            return null;
          }
          throw new Error(`Unsupported mocked wallet request: ${method}`);
        },
        on: (event: string, listener: (value: string) => void) => {
          const eventListeners = listeners.get(event) ?? new Set();
          eventListeners.add(listener);
          listeners.set(event, eventListeners);
        },
        removeListener: (event: string, listener: (value: string) => void) => {
          listeners.get(event)?.delete(listener);
        },
      };

      Object.defineProperty(window, "ethereum", { configurable: true, value: provider });
    },
    { address: walletAddress, initialChainId: "0x1" },
  );
  await page.goto("/connect");

  await page.getByRole("button", { name: /Injected/ }).click();
  await expect(page.getByRole("heading", { name: "You’re connected." })).toBeVisible();
  await expect(page.locator(".wallet-details")).toContainText("Unsupported network");

  await page.getByRole("button", { name: "Switch to Base Sepolia" }).click();
  await expect(page.locator(".wallet-details")).toContainText("Base Sepolia");
  await expect(page.getByText("Connected to the supported test network")).toBeVisible();

  await page.getByRole("button", { name: "Disconnect wallet" }).click();
  await expect(page.getByRole("heading", { name: "Connect your wallet." })).toBeVisible();
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

test("keeps onchain creation disabled without a verified factory", async ({ page }) => {
  await page.goto("/create");
  await page.getByLabel("Pot name").fill("Test pot");
  await page.getByLabel("Funding goal").fill("25");
  await page.getByLabel("Minimum contribution").fill("1");
  await page.locator("#pot-deadline").fill(
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
  );
  await page.getByRole("button", { name: "Preview pot rules" }).click();

  await expect(page.getByRole("button", { name: "Create pot on Base Sepolia" })).toBeDisabled();
  await expect(page.locator(".pot-create-unavailable")).toContainText(
    "Onchain creation is disabled until a deployed Base Sepolia factory is configured.",
  );
});

test("shows the shared pot contribution and settlement forms without enabling an unconnected wallet", async ({
  page,
  isMobile,
}) => {
  const potAddress = "0x1111111111111111111111111111111111111111";
  await page.route(`**/api/pots/${potAddress}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        address: potAddress,
        chainId: 84532,
        organizer: "0x2222222222222222222222222222222222222222",
        token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        name: "Shared trip",
        metadataURI: "",
        description: "A test pot.",
        coverImageUrl: null,
        targetBased: true,
        targetAmount: "100000000",
        deadline: "2000000000",
        minimumContribution: "1000000",
        totalContributed: "0",
        totalRefunded: "0",
        tokenDecimals: 6,
        tokenSymbol: "USDC",
        paidOut: false,
        contributionOpen: true,
        payoutEligible: false,
        refundEligible: false,
        explorerUrl: "https://sepolia.basescan.org",
        events: [],
      }),
    }),
  );
  await page.goto(`/pot/${potAddress}`);

  await expect(page.getByRole("heading", { name: "Shared trip" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contribute USDC" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payouts and refunds" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect wallet", exact: true })).toHaveAttribute(
    "href",
    "/connect",
  );
  await expect(page.getByRole("link", { name: "Connect wallet to check eligibility" })).toHaveAttribute(
    "href",
    "/connect",
  );
  await expect(page.getByRole("button", { name: "Contribute", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Withdraw pot funds" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Claim my refund" })).toHaveCount(0);
  if (isMobile) {
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  }
});

test("dashboard separates created pots from publicly indexed contributions", async ({ page }) => {
  const walletAddress = "0x1234567890123456789012345678901234567890";
  const createdPotAddress = "0x1111111111111111111111111111111111111111";
  const participatedPotAddress = "0x2222222222222222222222222222222222222222";
  await page.addInitScript((address) => {
    let authorized = false;
    const listeners = new Map<string, Set<(value: string) => void>>();
    const provider = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        if (method === "eth_chainId") return "0x14a34";
        if (method === "eth_accounts") return authorized ? [address] : [];
        if (method === "eth_requestAccounts") {
          authorized = true;
          return [address];
        }
        throw new Error(`Unsupported mocked wallet request: ${method}`);
      },
      on: (event: string, listener: (value: string) => void) => {
        const eventListeners = listeners.get(event) ?? new Set();
        eventListeners.add(listener);
        listeners.set(event, eventListeners);
      },
      removeListener: (event: string, listener: (value: string) => void) => {
        listeners.get(event)?.delete(listener);
      },
    };
    Object.defineProperty(window, "ethereum", { configurable: true, value: provider });
  }, walletAddress);
  await page.route("**/api/pots?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          address: createdPotAddress,
          name: "Organizer pot",
          targetBased: true,
          createdBlock: "100",
          escrowBalance: "25000001",
        },
      ]),
    }),
  );
  await page.route("**/api/pots/participating?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          address: participatedPotAddress,
          name: "Contributor pot",
          targetBased: false,
          createdBlock: "90",
          lastContributionBlock: "120",
          contributedAmount: "5000000",
          escrowBalance: "8000000",
        },
      ]),
    }),
  );
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Injected/ }).click();

  await expect(page.getByRole("heading", { name: "Pots you created" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Organizer pot/ })).toHaveAttribute(
    "href",
    `/pot/${createdPotAddress}`,
  );
  await expect(page.getByRole("heading", { name: "Pots you’ve contributed to" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Contributor pot/ })).toHaveAttribute(
    "href",
    `/pot/${participatedPotAddress}`,
  );
  await expect(page.getByText(/Last indexed contribution at block 120/)).toBeVisible();
  await expect(page.locator(".organizer-dashboard-totals").getByText("25.000001 USDC")).toBeVisible();
  await expect(page.locator(".organizer-dashboard-totals").getByText("5 USDC")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Pots you created" }).locator(".organizer-pot-cards"),
  ).toContainText("25.000001 USDC currently held");
  await expect(page.getByText(/8 USDC currently held/)).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
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
