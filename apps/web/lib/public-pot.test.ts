import { afterEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { getPublicParticipatedPots } from "./public-pot";

const contributor = getAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
const potA = "0x1111111111111111111111111111111111111111";
const potB = "0x2222222222222222222222222222222222222222";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getPublicParticipatedPots", () => {
  it("returns distinct public pots ordered by the latest indexed contribution", async () => {
    vi.stubEnv("SUPABASE_URL", "https://pot-project.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "public-anon-key");
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
      },
      {
        address: getAddress(potA),
        name: "Pot A",
        targetBased: true,
        createdBlock: "100",
        lastContributionBlock: "200",
      },
    ]);
    expect(requests).toHaveLength(2);
    expect(requests[0].searchParams.get("chain_id")).toBe("eq.84532");
    expect(requests[0].searchParams.get("event_name")).toBe("eq.ContributionMade");
    expect(requests[0].searchParams.get("event_data->>contributor")).toBe(`eq.${contributor}`);
    expect(requests[1].searchParams.get("is_public")).toBe("eq.true");
  });

  it("rejects invalid wallet addresses", async () => {
    await expect(getPublicParticipatedPots("invalid")).rejects.toMatchObject({ status: 400 });
  });
});
