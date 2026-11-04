import { afterEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { getPublicParticipatedPots } from "./public-pot";

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
      usdc,
      BigInt(2_000_000),
      BigInt(1_500_000),
      true,
      usdc,
      BigInt(1_000_000),
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
        targetBased: false,
        createdBlock: "110",
        lastContributionBlock: "250",
        contributedAmount: "500000",
        escrowBalance: "1000000",
      },
      {
        address: getAddress(potA),
        name: "Pot A",
        targetBased: true,
        createdBlock: "100",
        lastContributionBlock: "200",
        contributedAmount: "1500000",
        escrowBalance: "2000000",
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
