import { expect, test } from "@playwright/test";

test("landing page routes visitors to pot planning", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Big plans. One shared pot/ }),
  ).toBeVisible();
  await expect(
    page.getByText("No live payments.", { exact: true }),
  ).toBeVisible();
  await page.getByText("Can I collect money now?", { exact: true }).click();
  await expect(
    page.getByText(
      /Live payments are not available in an unconfigured installation/,
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Roadmap" })).toHaveAttribute(
    "href",
    "/roadmap",
  );
  await page.getByRole("link", { name: "Plan a pot" }).first().click();

  await expect(page).toHaveURL(/\/create$/);
  await expect(
    page.getByRole("heading", { name: "Plan a group fund." }),
  ).toBeVisible();
  await expect(
    page.getByText(/does not create a public pot or collect money/i),
  ).toBeVisible();
});

test("roadmap is directly accessible and labels gated MVP work", async ({
  page,
}) => {
  await page.goto("/roadmap");

  await expect(
    page.getByRole("heading", { name: "What works now—and what doesn’t." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Create and fund a pot" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Creating a pot and collecting real money are not available yet/i,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Group funds in other apps" }),
  ).toBeVisible();
  await expect(
    page.getByText("Planned only; no API is available today"),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(
    dimensions.viewportWidth,
  );
  await page
    .locator("header")
    .getByRole("link", { name: "Plan a pot" })
    .click();
  await expect(page).toHaveURL(/\/create$/);
});

test("wallet onboarding explains safe Base Sepolia test setup", async ({
  page,
}) => {
  await page.goto("/connect");

  await expect(
    page.getByRole("heading", { name: "Choose your wallet." }),
  ).toBeVisible();
  await expect(
    page.getByText("Base Sepolia test network", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This is a test network" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /does not approve a payment or give POT permission to move money/i,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Circle USDC testnet faucet" }),
  ).toHaveAttribute("href", "https://faucet.circle.com/");
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
        request: async ({
          method,
          params,
        }: {
          method: string;
          params?: unknown[];
        }) => {
          if (method === "eth_chainId") return chainId;
          if (method === "eth_accounts") return authorized ? [address] : [];
          if (method === "eth_requestAccounts") {
            authorized = true;
            return [address];
          }
          if (method === "wallet_switchEthereumChain") {
            const requestedChain = params?.[0] as
              { chainId?: string } | undefined;
            if (!requestedChain?.chainId)
              throw new Error("Missing requested chain ID");
            chainId = requestedChain.chainId;
            for (const listener of listeners.get("chainChanged") ?? [])
              listener(chainId);
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

      Object.defineProperty(window, "ethereum", {
        configurable: true,
        value: provider,
      });
    },
    { address: walletAddress, initialChainId: "0x1" },
  );
  await page.goto("/connect");

  await page.getByRole("button", { name: /Injected/ }).click();
  await expect(
    page.getByRole("heading", { name: "Wallet connected." }),
  ).toBeVisible();
  await expect(page.locator(".wallet-details")).toContainText(
    "Not on Base Sepolia",
  );

  await page.getByRole("button", { name: "Switch to Base Sepolia" }).click();
  await expect(page.locator(".wallet-details")).toContainText("Base Sepolia");
  await expect(
    page.getByText("Ready to view pots on the test network"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Disconnect wallet" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose your wallet." }),
  ).toBeVisible();
});

test("validates and previews a goal-based pot", async ({ page }) => {
  await page.goto("/create");
  await expect(
    page.getByRole("radio", { name: /Let the organizer decide/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Preview this plan" }).click();

  const alert = page.locator(".pot-form-errors");
  await expect(alert).toContainText("Enter a name for your pot.");
  await expect(alert).toContainText("Enter a minimum contribution");
  await expect(alert).toContainText("Enter a goal greater than zero");
  await expect(alert).toContainText("Choose a deadline for this pot.");

  await page.getByLabel("Pot name").fill("Community trip");
  await page
    .getByLabel("What is this pot for? (optional)")
    .fill("A weekend away together.");
  await page.getByLabel("Funding goal").fill("250");
  await page.getByLabel("Smallest amount someone can contribute").fill("5");
  const futureDeadline = new Date(Date.now() + 86_400_000)
    .toISOString()
    .slice(0, 16);
  await page.locator("#pot-deadline").fill(futureDeadline);
  await page.getByRole("button", { name: "Preview this plan" }).click();

  const preview = page.locator(".pot-create-preview");
  await expect(
    preview.getByRole("heading", { name: "Community trip" }),
  ).toBeVisible();
  await expect(preview).toContainText("250");
  await expect(preview).toContainText("A weekend away together.");
  await expect(alert).toHaveCount(0);
});

test("previews both crowdfunding withdrawal rules and the visible payout wallet", async ({
  page,
}) => {
  await page.goto("/create");
  await page
    .getByRole("radio", { name: /Crowdfund until the deadline/ })
    .check();
  await page.getByLabel("Pot name").fill("Community fundraiser");
  await page.getByLabel("Fundraising goal").fill("100");
  await page.getByLabel("Smallest amount someone can contribute").fill("1");
  await page
    .getByLabel("Approved payout wallet")
    .fill("0x1111111111111111111111111111111111111111");
  await page
    .locator("#pot-deadline")
    .fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16));

  await page.getByRole("button", { name: "Preview this plan" }).click();
  const preview = page.locator(".pot-create-preview");
  await expect(preview).toContainText("Crowdfunding; payout after deadline");
  await expect(preview).toContainText(
    "0x1111111111111111111111111111111111111111",
  );
  await expect(preview).toContainText(
    "Contributors cannot claim refunds under this rule.",
  );

  await page
    .getByRole("radio", {
      name: /Let the approved wallet withdraw as funds come in/,
    })
    .check();
  await page.getByRole("button", { name: "Preview this plan" }).click();
  await expect(preview).toContainText("approved wallet may withdraw anytime");
  await expect(preview).toContainText(
    "withdraw the current balance at any time",
  );
});

test("keeps onchain creation disabled without a verified factory", async ({
  page,
}) => {
  await page.goto("/create");
  await page.getByLabel("Pot name").fill("Test pot");
  await page.getByLabel("Funding goal").fill("25");
  await page.getByLabel("Smallest amount someone can contribute").fill("1");
  await page
    .locator("#pot-deadline")
    .fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Preview this plan" }).click();

  await expect(page.getByRole("button", { name: "Create pot" })).toBeDisabled();
  await expect(page.locator(".pot-create-unavailable")).toContainText(
    "You can preview and save this plan, but you cannot create a public pot yet.",
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
        payoutRecipient: "0x2222222222222222222222222222222222222222",
        fundingMode: 0,
        token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        name: "Shared trip",
        metadataURI: "",
        description: "A test pot.",
        coverImageUrl: null,
        isPublic: true,
        targetBased: true,
        targetAmount: "100000000",
        deadline: "2000000000",
        minimumContribution: "1000000",
        totalContributed: "0",
        totalRefunded: "0",
        totalPaidOut: "0",
        currentBalance: "0",
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

  await expect(
    page.getByRole("heading", { name: "Shared trip" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Contribute USDC" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Payouts and refunds" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Connect wallet", exact: true }),
  ).toHaveAttribute("href", "/connect");
  await expect(
    page.getByRole("link", { name: "Connect wallet to check eligibility" }),
  ).toHaveAttribute("href", "/connect");
  await expect(
    page.getByRole("button", { name: "Contribute", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Withdraw pot funds" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Claim my refund" }),
  ).toHaveCount(0);
  if (isMobile) {
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(
      dimensions.viewportWidth,
    );
  }
});

test("publishes public pot description only after the organizer signs and consents", async ({
  page,
}) => {
  const potAddress = "0x1111111111111111111111111111111111111111";
  const walletAddress = "0x2222222222222222222222222222222222222222";
  let publishedDescription = "";
  let submittedUpdate: Record<string, unknown> | undefined;
  let challengedDescription = "";

  await page.addInitScript((address) => {
    const listeners = new Map<string, Set<(value: string) => void>>();
    const provider = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        if (method === "eth_chainId") return "0x14a34";
        if (method === "eth_accounts" || method === "eth_requestAccounts")
          return [address];
        if (method === "personal_sign") return `0x${"11".repeat(65)}`;
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
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: provider,
    });
  }, walletAddress);
  await page.goto("/connect");
  await page.getByRole("button", { name: /Injected/ }).click();
  await expect(
    page.getByRole("heading", { name: "Wallet connected." }),
  ).toBeVisible();

  await page.route(`**/api/pots/${potAddress}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        address: potAddress,
        chainId: 84532,
        organizer: walletAddress,
        payoutRecipient: walletAddress,
        fundingMode: 1,
        token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        name: "Shared trip",
        metadataURI: "",
        description: publishedDescription,
        coverImageUrl: null,
        isPublic: true,
        targetBased: false,
        targetAmount: "0",
        deadline: "0",
        minimumContribution: "1000000",
        totalContributed: "0",
        totalRefunded: "0",
        totalPaidOut: "0",
        currentBalance: "0",
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
  await page.route("**/api/pots/metadata/challenge", async (route) => {
    challengedDescription = String(route.request().postDataJSON().description);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        nonce: "0123456789abcdef0123456789abcdef",
        message:
          "Authorize publishing this public description for this public pot.",
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }),
    });
  });
  await page.route("**/api/pots/metadata", async (route) => {
    submittedUpdate = route.request().postDataJSON() as Record<string, unknown>;
    publishedDescription = String(submittedUpdate.description);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.goto(`/pot/${potAddress}`);
  const editor = page.getByRole("region", { name: "Who can open this pot?" });
  await expect(editor).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "Sign and make pot public" }),
  ).toBeDisabled();
  await editor
    .getByRole("textbox", { name: /Description/ })
    .fill("A weekend away together.");
  await editor
    .getByLabel(
      "I understand anyone can find this pot and read its description.",
    )
    .check();
  await editor
    .getByRole("button", { name: "Sign and make pot public" })
    .click();

  await expect(editor.getByRole("status")).toContainText(
    "Saved. Anyone can find and open this pot.",
  );
  await expect
    .poll(() => submittedUpdate?.description)
    .toBe("A weekend away together.");
  await expect
    .poll(() => challengedDescription)
    .toBe("A weekend away together.");
  expect(submittedUpdate?.walletAddress).toBe(walletAddress);
  expect(submittedUpdate?.isPublic).toBe(true);
  expect(submittedUpdate?.accessKey).toBeNull();
  expect(typeof submittedUpdate?.signature).toBe("string");
  await expect(
    page.getByText("A weekend away together.").first(),
  ).toBeVisible();
});

test("private pots require the designated fragment link and send its key only in a header", async ({
  page,
}) => {
  const potAddress = "0x1111111111111111111111111111111111111111";
  const accessKey = "a".repeat(64);
  const pot = {
    address: potAddress,
    chainId: 84532,
    organizer: "0x2222222222222222222222222222222222222222",
    payoutRecipient: "0x2222222222222222222222222222222222222222",
    fundingMode: 1,
    token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    name: "Friends’ cabin weekend",
    metadataURI: "",
    description: "A private group plan.",
    coverImageUrl: null,
    isPublic: false,
    targetBased: false,
    targetAmount: "0",
    deadline: "0",
    minimumContribution: "1000000",
    totalContributed: "0",
    totalRefunded: "0",
    totalPaidOut: "0",
    currentBalance: "0",
    tokenDecimals: 6,
    tokenSymbol: "USDC",
    paidOut: false,
    contributionOpen: true,
    payoutEligible: false,
    refundEligible: false,
    explorerUrl: "https://sepolia.basescan.org",
    events: [],
  };
  let observedAccessKey: string | undefined;
  await page.route(`**/api/pots/${potAddress}`, async (route) => {
    observedAccessKey = route.request().headers()["x-pot-access-key"];
    expect(route.request().url()).not.toContain("access=");
    if (observedAccessKey !== accessKey) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          error:
            "This pot isn’t available. Check the link with the person who shared it.",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pot),
    });
  });

  await page.goto(`/pot/${potAddress}`);
  await expect(
    page.getByRole("heading", { name: "We can’t open this pot." }),
  ).toBeVisible();

  await page.goto(`/pot/${potAddress}#access=${accessKey}`);
  await expect(
    page.getByRole("heading", { name: "Friends’ cabin weekend" }),
  ).toBeVisible();
  await expect(
    page.getByText("Private · anyone with this link can open it"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy private link" }),
  ).toBeVisible();
  expect(observedAccessKey).toBe(accessKey);
});

test("dashboard separates created pots from publicly indexed contributions", async ({
  page,
}) => {
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
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: provider,
    });
  }, walletAddress);
  await page.route("**/api/pots?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          address: createdPotAddress,
          name: "Organizer pot",
          fundingMode: 0,
          targetBased: true,
          createdBlock: "100",
          escrowBalance: "25000001",
          totalContributed: "50000000",
          contributionOpen: true,
          paidOut: false,
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
          fundingMode: 1,
          targetBased: false,
          createdBlock: "90",
          lastContributionBlock: "120",
          contributedAmount: "5000000",
          escrowBalance: "8000000",
          totalContributed: "10000000",
          contributionOpen: true,
          paidOut: false,
        },
      ]),
    }),
  );
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Injected/ }).click();

  await expect(
    page.getByRole("heading", { name: "Pots you created" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Organizer pot/ }),
  ).toHaveAttribute("href", `/pot/${createdPotAddress}`);
  await expect(
    page.getByRole("heading", { name: "Pots you contributed to" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Contributor pot/ }),
  ).toHaveAttribute("href", `/pot/${participatedPotAddress}`);
  await expect(
    page.locator(".organizer-dashboard-totals").getByText("25.000001 USDC"),
  ).toBeVisible();
  await expect(
    page.locator(".organizer-dashboard-totals").getByText("5 USDC"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Pots you created" })
      .locator(".organizer-pot-cards"),
  ).toContainText("25.000001 USDC currently in the pot");
  await expect(
    page.getByText(
      /You contributed 5 USDC in total; 8 USDC remains in the pot/,
    ),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(
    dimensions.viewportWidth,
  );
});

test("restores and clears a saved local draft only after confirmation", async ({
  page,
}) => {
  await page.goto("/create");
  await page.getByLabel("Pot name").fill("Saved trip");
  await page.getByLabel("Smallest amount someone can contribute").fill("2");
  await page.getByRole("button", { name: "Save draft on this device" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Draft saved in this browser",
  );

  await page.getByLabel("Pot name").fill("Unsaved replacement");
  await page.getByRole("button", { name: "Restore saved draft" }).click();
  const confirmation = page.getByRole("group", {
    name: "Confirm local draft action",
  });
  await expect(confirmation).toContainText(
    "Restoring will replace the values currently in the form.",
  );
  await confirmation
    .getByRole("button", { name: "Replace form values" })
    .click();
  await expect(page.getByLabel("Pot name")).toHaveValue("Saved trip");

  await page
    .locator(".pot-draft-actions")
    .getByRole("button", { name: "Clear saved draft" })
    .click();
  await expect(confirmation).toContainText(
    "Remove the saved draft from this device?",
  );
  await confirmation.getByRole("button", { name: "Clear saved draft" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Saved draft removed from this browser",
  );
});

test("landing and planning layouts fit the mobile viewport", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Responsive overflow assertion is for mobile Chromium.");

  for (const route of ["/", "/create"]) {
    await page.goto(route);
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(
      dimensions.viewportWidth,
    );
  }
});
