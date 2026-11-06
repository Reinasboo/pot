import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { getAddress } from "viem";
import {
  createPotMetadataChallenge,
  getSameRequestOrigin,
  PotMetadataError,
  publishPotDescription,
} from "./pot-metadata";

const mocks = vi.hoisted(() => ({
  getChainId: vi.fn(),
  getBlockNumber: vi.fn(),
  readContract: vi.fn(),
  verifyMessage: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => mocks),
  };
});

const walletAddress = getAddress("0x2222222222222222222222222222222222222222");
const potAddress = getAddress("0x1111111111111111111111111111111111111111");
const nonce = "0123456789abcdef0123456789abcdef";
const serviceRoleKey = "server-only-test-key";

function getPublicMetadataStatement(description: string): string {
  return `Authorize updating pot visibility and description for pot ${potAddress}: ` +
    JSON.stringify({ description, visibility: "public", accessKeyHash: null });
}

function getPrivateMetadataStatement(description: string, accessKeyHash: string): string {
  return `Authorize updating pot visibility and description for pot ${potAddress}: ` +
    JSON.stringify({ description, visibility: "private", accessKeyHash });
}

function configureEnvironment() {
  vi.stubEnv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org");
  vi.stubEnv("POT_FACTORY_ADDRESS", "0x5555555555555555555555555555555555555555");
  vi.stubEnv("NEXT_PUBLIC_POT_FACTORY_ADDRESS", "0x5555555555555555555555555555555555555555");
  vi.stubEnv("SUPABASE_URL", "https://pot-project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey);
  mocks.getChainId.mockResolvedValue(84532);
  mocks.getBlockNumber.mockResolvedValue(BigInt(500));
  mocks.readContract.mockImplementation(({ functionName }: { functionName: string }) =>
    Promise.resolve(functionName === "isPot" ? true : walletAddress),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("pot metadata authorization", () => {
  it("binds a short-lived sign-in message to the pot, wallet, origin, and Base Sepolia", async () => {
    configureEnvironment();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test-only-key");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("apikey")).toBe("sb_secret_test-only-key");
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      if (new URL(input.toString()).pathname.endsWith("/pots")) {
        return Response.json([{ address: potAddress.toLowerCase() }]);
      }
      return Response.json(true);
    });
    vi.stubGlobal("fetch", fetchMock);

    const challenge = await createPotMetadataChallenge(
      walletAddress,
      potAddress,
      "https://pot.example",
      "A weekend away together.",
    );

    expect(challenge.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(challenge.message).toContain(walletAddress);
    expect(challenge.message).toContain(potAddress);
    expect(challenge.message).toContain('"A weekend away together."');
    expect(challenge.message).toContain("https://pot.example/pot/");
    expect(challenge.message).toContain("Chain ID: 84532");
    expect(challenge.message).toContain(`Nonce: ${challenge.nonce}`);
    expect(Date.parse(challenge.expiresAt)).toBeGreaterThan(Date.now());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      p_wallet_address: walletAddress.toLowerCase(),
      p_pot_address: potAddress.toLowerCase(),
      p_origin: "https://pot.example",
    });
  });

  it("rejects challenge requests from another origin", () => {
    const request = new Request("https://pot.example/api/pots/metadata", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });

    expect(() => getSameRequestOrigin(request)).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("rejects a wallet that is not the onchain organizer", async () => {
    configureEnvironment();
    mocks.readContract.mockImplementation(({ functionName }: { functionName: string }) =>
      Promise.resolve(functionName === "isPot" ? true : getAddress("0x3333333333333333333333333333333333333333")),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createPotMetadataChallenge(
        walletAddress,
        potAddress,
        "https://pot.example",
        "A weekend away together.",
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a rate-limited challenge response", async () => {
    configureEnvironment();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      new URL(input.toString()).pathname.endsWith("/pots")
        ? Response.json([{ address: potAddress.toLowerCase() }])
        : Response.json(false),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createPotMetadataChallenge(
        walletAddress,
        potAddress,
        "https://pot.example",
        "A weekend away together.",
      ),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("does not ask for a signature until the created pot is indexed", async () => {
    configureEnvironment();
    const fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
    createPotMetadataChallenge(
      walletAddress,
      potAddress,
      "https://pot.example",
      "A weekend away together.",
    ),
    ).rejects.toMatchObject({
    status: 409,
    message: "This pot is not indexed yet. Wait for indexing, then sign again to save its settings.",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("persists an explicitly authorized description and consumes the nonce once", async () => {
    configureEnvironment();
    mocks.verifyMessage.mockResolvedValue(true);
    let consumed = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/pot_metadata_nonces") && init?.method === "PATCH") {
        if (consumed) return Response.json([]);
        consumed = true;
        return Response.json([{ nonce }]);
      }
      if (url.pathname.endsWith("/rpc/save_pot_visibility")) {
        return Response.json(true);
      }
      if (url.pathname.endsWith("/pot_metadata_nonces")) {
        if (consumed) return Response.json([]);
        return Response.json([{
          nonce,
          wallet_address: walletAddress.toLowerCase(),
          pot_address: potAddress.toLowerCase(),
          origin: "https://pot.example",
          message: `${getPublicMetadataStatement("A weekend away together.")}\n\nURI: https://pot.example/pot/${potAddress.toLowerCase()}`,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        }]);
      }
      return Response.json([{ address: potAddress.toLowerCase() }]);
    });

    vi.stubGlobal("fetch", fetchMock);

    await publishPotDescription({
      walletAddress,
      potAddress,
      nonce,
      signature: `0x${"11".repeat(65)}`,
      description: "  A weekend away together.  ",
      origin: "https://pot.example",
    });

    await expect(
      publishPotDescription({
        walletAddress,
        potAddress,
        nonce,
        signature: `0x${"11".repeat(65)}`,
        description: "A replayed update",
        origin: "https://pot.example",
      }),
    ).rejects.toMatchObject({ status: 401 });

    expect(mocks.verifyMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        address: walletAddress,
        message: `${getPublicMetadataStatement("A weekend away together.")}\n\nURI: https://pot.example/pot/${potAddress.toLowerCase()}`,
      }),
    );
    const consumeRequest = fetchMock.mock.calls.find(([input, init]) =>
      new URL(input.toString()).pathname.endsWith("/pot_metadata_nonces") &&
      init?.method === "PATCH",
    );
    expect(consumeRequest).toBeDefined();
    const updateRequest = fetchMock.mock.calls.find(([input, init]) =>
      new URL(input.toString()).pathname.endsWith("/rpc/save_pot_visibility") &&
      init?.method === "POST",
    );
    expect(JSON.parse(String(updateRequest?.[1]?.body))).toEqual({
      p_chain_id: 84532,
      p_pot_address: potAddress.toLowerCase(),
      p_organizer: walletAddress.toLowerCase(),
      p_description: "A weekend away together.",
      p_is_public: true,
      p_access_key_hash: null,
    });
    expect(new Headers(updateRequest?.[1]?.headers).get("authorization")).toBe(
      `Bearer ${serviceRoleKey}`,
    );
  });

  it("stores only the hash of a private link key and binds visibility to the wallet signature", async () => {
    configureEnvironment();
    mocks.verifyMessage.mockResolvedValue(true);
    const accessKey = "a".repeat(64);
    const accessKeyHash = createHash("sha256").update(accessKey).digest("hex");
    const message = `${getPrivateMetadataStatement("A private plan.", accessKeyHash)}\n\nURI: https://pot.example/pot/${potAddress.toLowerCase()}`;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/rpc/issue_pot_metadata_nonce")) return Response.json(true);
      if (url.pathname.endsWith("/rpc/save_pot_visibility")) return Response.json(true);
      if (url.pathname.endsWith("/pot_metadata_nonces") && init?.method === "PATCH") {
        return Response.json([{ nonce }]);
      }
      if (url.pathname.endsWith("/pot_metadata_nonces")) {
        return Response.json([{
          nonce,
          wallet_address: walletAddress.toLowerCase(),
          pot_address: potAddress.toLowerCase(),
          origin: "https://pot.example",
          message,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        }]);
      }
      return Response.json([{ address: potAddress.toLowerCase() }]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const challenge = await createPotMetadataChallenge(
      walletAddress,
      potAddress,
      "https://pot.example",
      "A private plan.",
      false,
      accessKeyHash,
    );
    expect(challenge.message).toContain(accessKeyHash);
    expect(challenge.message).not.toContain(accessKey);

    await publishPotDescription({
      walletAddress,
      potAddress,
      nonce,
      signature: `0x${"11".repeat(65)}`,
      description: "A private plan.",
      isPublic: false,
      accessKey,
      origin: "https://pot.example",
    });

    const saveRequest = fetchMock.mock.calls.find(([input]) =>
      new URL(input.toString()).pathname.endsWith("/rpc/save_pot_visibility"),
    );
    expect(JSON.parse(String(saveRequest?.[1]?.body))).toMatchObject({
      p_is_public: false,
      p_access_key_hash: accessKeyHash,
    });
  });

  it("does not consume or write metadata when the signature is invalid", async () => {
    configureEnvironment();
    mocks.verifyMessage.mockResolvedValue(false);
    const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
      void args;
      return Response.json([{
        nonce,
        wallet_address: walletAddress.toLowerCase(),
        pot_address: potAddress.toLowerCase(),
        origin: "https://pot.example",
        message: `${getPublicMetadataStatement("Expired update")}\n\nURI: https://pot.example/pot/${potAddress.toLowerCase()}`,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      }]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishPotDescription({
        walletAddress,
        potAddress,
        nonce,
        signature: `0x${"11".repeat(65)}`,
        description: "Unauthorized update",
        origin: "https://pot.example",
      }),
    ).rejects.toBeInstanceOf(PotMetadataError);
    await expect(
      publishPotDescription({
        walletAddress,
        potAddress,
        nonce,
        signature: `0x${"11".repeat(65)}`,
        description: "Unauthorized update",
        origin: "https://pot.example",
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "PATCH"))
      .toBe(true);
  });

  it("rejects a description different from the one included in the signed challenge", async () => {
    configureEnvironment();
    const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
      void args;
      return Response.json([{
        nonce,
        wallet_address: walletAddress.toLowerCase(),
        pot_address: potAddress.toLowerCase(),
        origin: "https://pot.example",
        message: `${getPublicMetadataStatement("Signed text")}\n\nURI: https://pot.example/pot/${potAddress.toLowerCase()}`,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      }]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishPotDescription({
        walletAddress,
        potAddress,
        nonce,
        signature: `0x${"11".repeat(65)}`,
        description: "Substituted text",
        origin: "https://pot.example",
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(mocks.verifyMessage).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects expired challenges before signature verification", async () => {
    configureEnvironment();
    const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
      void args;
      return Response.json([{
        nonce,
        wallet_address: walletAddress.toLowerCase(),
        pot_address: potAddress.toLowerCase(),
        origin: "https://pot.example",
        message: `${getPublicMetadataStatement("Not indexed yet")}\n\nURI: https://pot.example/pot/${potAddress.toLowerCase()}`,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      }]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishPotDescription({
        walletAddress,
        potAddress,
        nonce,
        signature: `0x${"11".repeat(65)}`,
        description: "Expired update",
        origin: "https://pot.example",
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(mocks.verifyMessage).not.toHaveBeenCalled();
  });

  it("does not consume a challenge when the pot has not been indexed", async () => {
    configureEnvironment();
    mocks.verifyMessage.mockResolvedValue(true);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/pot_metadata_nonces")) {
        return Response.json([{
          nonce,
          wallet_address: walletAddress.toLowerCase(),
          pot_address: potAddress.toLowerCase(),
          origin: "https://pot.example",
          message: `${getPublicMetadataStatement("Not indexed yet")}\n\nURI: https://pot.example/pot/${potAddress.toLowerCase()}`,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        }]);
      }
      if (init?.method === "PATCH") return Response.json([{ nonce }]);
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishPotDescription({
        walletAddress,
        potAddress,
        nonce,
        signature: `0x${"11".repeat(65)}`,
        description: "Not indexed yet",
        origin: "https://pot.example",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "PATCH")).toBe(true);
  });
});
