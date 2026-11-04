import { afterEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { getPublicParticipatedPots, getPublicPot } from "./public-pot";

const mocks = vi.hoisted(() => ({
  getChainId: vi.fn(),
  getBlockNumber: vi.fn(),
  readContract: vi.fn(),
  multicall: vi.fn(),
}));

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => mocks),
  };
});

const contributor = getAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
const potA = "0x1111111111111111111111111111111111111111";
const potB = "0x2222222222222222222222222222222222222222";
const usdc = getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
const privateAccessKey = "a".repeat(64);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("getPublicParticipatedPots", () => {
  it("returns distinct public pots ordered by the latest indexed contribution", async () => {
    vi.stubEnv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org");
    vi.stubEnv("POT_FACTORY_ADDRESS", "0x5555555555555555555555555555555555555555");
    vi.stubEnv("SUPABASE_URL", "https://pot-project.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "public-anon-key");
    mocks.getChainId.mockResolvedValue(84532);
    mocks.getBlockNumber.mockResolvedValue(BigInt(500));
    mocks.readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "token") return Promise.resolve(usdc);
      if (functionName === "decimals") return Promise.resolve(6);
      if (functionName === "symbol") return Promise.resolve("USDC");
      throw new Error(`Unexpected contract read: ${functionName}`);
    });

    mocks.multicall.mockResolvedValue([
      true,
      0,
      usdc,
      BigInt(2_000_000),
      BigInt(1_500_000),
      false,
      false,
      BigInt(1_500_000),
      true,
      1,
      usdc,
      BigInt(1_000_000),
      BigInt(1_000_000),
      true,
      false,
      BigInt(500_000),
    ]);
    const requests: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(input.toString());
        requests.push(url);
        if (url.pathname.endsWith("/pot_events")) {
          return Response.json([
            {
              pot_address: potB,
              block_number: "250",
              event_data: { contributor },
            },
            {
              pot_address: potA,
              block_number: "200",
              event_data: { contributor },
            },
            {
              pot_address: potA,
              block_number: "150",
              event_data: { contributor },
            },
            {
              pot_address: "0x3333333333333333333333333333333333333333",
              block_number: "300",
              event_data: { contributor: "0x4444444444444444444444444444444444444444" },
            },
          ]);
        }
        return Response.json([
          {
            address: potA,
            name: "Pot A",
            target_based: true,
            created_block: "100",
          },
          {
            address: potB,
            name: "Pot B",
            target_based: false,
            created_block: "110",
          },
        ]);
      }),
    );

    const pots = await getPublicParticipatedPots(contributor.toLowerCase());

    expect(pots).toEqual([
      {
        address: getAddress(potB),
        name: "Pot B",
        fundingMode: 1,
        targetBased: false,
        createdBlock: "110",
        lastContributionBlock: "250",
        contributedAmount: "500000",
        escrowBalance: "1000000",
        totalContributed: "1000000",
        contributionOpen: true,
        paidOut: false,
      },
      {
        address: getAddress(potA),
        name: "Pot A",
        fundingMode: 0,
        targetBased: true,
        createdBlock: "100",
        lastContributionBlock: "200",
        contributedAmount: "1500000",
        escrowBalance: "2000000",
        totalContributed: "1500000",
        contributionOpen: false,
        paidOut: false,
      },
    ]);
    expect(requests).toHaveLength(2);
    expect(requests[0].searchParams.get("chain_id")).toBe("eq.84532");
    expect(requests[0].searchParams.get("event_name")).toBe("eq.ContributionMade");
    expect(requests[0].searchParams.get("event_data->>contributor")).toBe(`eq.${contributor}`);
    expect(requests[1].searchParams.get("is_public")).toBe("eq.true");
    expect(mocks.multicall).toHaveBeenCalledWith(
      expect.objectContaining({
        blockNumber: BigInt(500),
        allowFailure: false,
        contracts: expect.arrayContaining([
          expect.objectContaining({ functionName: "contributions" }),
          expect.objectContaining({ functionName: "balanceOf" }),
        ]),
      }),
    );
  });

  it("rejects invalid wallet addresses", async () => {
    await expect(getPublicParticipatedPots("invalid")).rejects.toMatchObject({ status: 400 });
  });

  it("fails closed if the RPC is not Base Sepolia", async () => {
    vi.stubEnv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org");
    vi.stubEnv("POT_FACTORY_ADDRESS", "0x5555555555555555555555555555555555555555");
    vi.stubEnv("SUPABASE_URL", "https://pot-project.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "public-anon-key");
    mocks.getChainId.mockResolvedValue(8453);
    mocks.getBlockNumber.mockResolvedValue(BigInt(500));
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(Response.json([
          {
            pot_address: potA,
            block_number: "250",
            event_data: { contributor },
          },
        ]))
        .mockResolvedValueOnce(Response.json([
          {
            address: potA,
            name: "Pot A",
            target_based: true,
            created_block: "100",
          },
        ])),
    );

    await expect(getPublicParticipatedPots(contributor)).rejects.toMatchObject({ status: 503 });
  });
});

describe("private pot access", () => {
  it("requires the designated key before returning private pot details or events", async () => {
    vi.stubEnv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org");
    vi.stubEnv("POT_FACTORY_ADDRESS", "0x5555555555555555555555555555555555555555");
    vi.stubEnv("SUPABASE_URL", "https://pot-project.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "public-anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_server-key");
    mocks.getChainId.mockResolvedValue(84532);
    mocks.getBlockNumber.mockResolvedValue(BigInt(500));
    mocks.readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      const values: Record<string, unknown> = {
        isPot: true,
        token: usdc,
        organizer: contributor,
        payoutRecipient: contributor,
        fundingMode: 1,
        targetBased: false,
        targetAmount: BigInt(0),
        deadline: BigInt(0),
        minimumContribution: BigInt(1_000_000),
        name: "Private group fund",
        metadataURI: "",
        totalContributed: BigInt(0),
        totalRefunded: BigInt(0),
        totalPaidOut: BigInt(0),
        paidOut: false,
        isContributionOpen: true,
        isPayoutEligible: false,
        isRefundEligible: false,
        decimals: 6,
        symbol: "USDC",
        balanceOf: BigInt(0),
      };
      return Promise.resolve(values[functionName]);
    });
    const keyHash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(privateAccessKey))),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    const requestedPaths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      requestedPaths.push(url.pathname);
      if (url.pathname.endsWith("/pots")) {
        return Response.json([{
          description: "For invited friends.",
          cover_image_url: null,
          is_public: false,
        }]);
      }
      if (url.pathname.endsWith("/private_pot_access")) {
        return Response.json([{ access_key_hash: keyHash }]);
      }
      if (url.pathname.endsWith("/pot_events")) return Response.json([]);
      return Response.json([]);
    }));

    await expect(getPublicPot(potA)).rejects.toMatchObject({ status: 404 });
    expect(requestedPaths).not.toContain("/rest/v1/pot_events");

    requestedPaths.length = 0;
    await expect(getPublicPot(potA, "b".repeat(64))).rejects.toMatchObject({ status: 404 });
    expect(requestedPaths).not.toContain("/rest/v1/pot_events");

    requestedPaths.length = 0;
    const pot = await getPublicPot(potA, privateAccessKey);
    expect(pot.isPublic).toBe(false);
    expect(pot.description).toBe("For invited friends.");
    expect(requestedPaths).toContain("/rest/v1/pot_events");
  });
});
