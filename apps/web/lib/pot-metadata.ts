import "server-only";

import { createHash, randomBytes } from "node:crypto";
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  isHex,
  parseAbi,
} from "viem";
import { baseSepolia } from "viem/chains";

const factoryAbi = parseAbi([
  "function isPot(address pot) view returns (bool)",
]);
const potAbi = parseAbi([
  "function organizer() view returns (address)",
]);
const nonceLifetimeMs = 5 * 60 * 1000;
const maxDescriptionLength = 2000;

type MetadataEnvironment = {
  rpcUrl: string;
  factoryAddress: `0x${string}`;
  supabaseUrl: string;
  serviceRoleKey: string;
};

type NonceRow = {
  nonce: string;
  wallet_address: string;
  pot_address: string;
  origin: string;
  message: string;
  expires_at: string;
};

export class PotMetadataError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PotMetadataError";
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new PotMetadataError(`Pot metadata service is missing ${name}.`, 503);
  }
  return value;
}

function getEnvironment(): MetadataEnvironment {
  const rpcUrl = requiredEnvironment("BASE_SEPOLIA_RPC_URL");
  const factoryAddress = requiredEnvironment("POT_FACTORY_ADDRESS");
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");

  let parsedRpcUrl: URL;
  let parsedSupabaseUrl: URL;
  try {
    parsedRpcUrl = new URL(rpcUrl);
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw new PotMetadataError("Pot metadata service configuration is invalid.", 503);
  }

  if (
    parsedRpcUrl.protocol !== "https:" ||
    parsedSupabaseUrl.protocol !== "https:" ||
    parsedSupabaseUrl.username ||
    parsedSupabaseUrl.password ||
    !isAddress(factoryAddress)
  ) {
    throw new PotMetadataError("Pot metadata service configuration is invalid.", 503);
  }

  const publicFactoryAddress = process.env.NEXT_PUBLIC_POT_FACTORY_ADDRESS?.trim();
  if (publicFactoryAddress) {
    if (
      !isAddress(publicFactoryAddress) ||
      getAddress(publicFactoryAddress) !== getAddress(factoryAddress)
    ) {
      throw new PotMetadataError(
        "Server and public factory addresses must match before publishing metadata.",
        503,
      );
    }
  }

  return {
    rpcUrl,
    factoryAddress: getAddress(factoryAddress),
    supabaseUrl: parsedSupabaseUrl.toString().replace(/\/+$/, ""),
    serviceRoleKey,
  };
}

export function getSameRequestOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    throw new PotMetadataError("Pot metadata requests must come from this site.", 403);
  }

  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    throw new PotMetadataError("Pot metadata requests must come from this site.", 403);
  }

  const isLocalHttp =
    requestUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname);
  if (
    origin.origin !== requestUrl.origin ||
    (requestUrl.protocol !== "https:" && !isLocalHttp)
  ) {
    throw new PotMetadataError("Pot metadata requests must come from this site.", 403);
  }

  return origin.origin;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new PotMetadataError("A JSON request body is required.", 415);
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 16_384) {
    throw new PotMetadataError("Pot metadata requests are too large.", 413);
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new PotMetadataError("The request body must be valid JSON.", 400);
  }
}

function getPublicClient(environment: MetadataEnvironment) {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(environment.rpcUrl),
  });
}

async function getVerifiedOrganizer(
  environment: MetadataEnvironment,
  potAddress: `0x${string}`,
): Promise<`0x${string}`> {
  const client = getPublicClient(environment);

  let chainId: number;
  let blockNumber: bigint;
  try {
    [chainId, blockNumber] = await Promise.all([
      client.getChainId(),
      client.getBlockNumber(),
    ]);
  } catch (error) {
    console.error(
      "Could not read the Base Sepolia metadata authorization snapshot",
      error instanceof Error ? error.name : "Unknown error",
    );
    throw new PotMetadataError("Could not verify pot ownership on Base Sepolia.", 502);
  }
  if (chainId !== baseSepolia.id) {
    throw new PotMetadataError(
      `Configured RPC returned chain ID ${chainId}, expected 84532.`,
      503,
    );
  }

  try {
    const [isPot, organizer] = await Promise.all([
      client.readContract({
        address: environment.factoryAddress,
        abi: factoryAbi,
        functionName: "isPot",
        args: [potAddress],
        blockNumber,
      }),
      client.readContract({
        address: potAddress,
        abi: potAbi,
        functionName: "organizer",
        blockNumber,
      }),
    ]);
    if (!isPot) throw new PotMetadataError("This pot is not registered in the configured factory.", 404);
    return organizer;
  } catch (error) {
    if (error instanceof PotMetadataError) throw error;
    console.error(
      "Could not verify pot registration and organizer",
      error instanceof Error ? error.name : "Unknown error",
    );
    throw new PotMetadataError("Could not verify pot ownership on Base Sepolia.", 502);
  }
}

async function supabaseRequest(
  environment: MetadataEnvironment,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set("apikey", environment.serviceRoleKey);
    if (environment.serviceRoleKey.startsWith("sb_secret_")) {
      headers.delete("authorization");
    } else {
      headers.set("authorization", `Bearer ${environment.serviceRoleKey}`);
    }
    headers.set("content-type", "application/json");
    response = await fetch(`${environment.supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    console.error(
      "Could not connect to Supabase for pot metadata",
      error instanceof Error ? error.name : "Unknown error",
    );
    throw new PotMetadataError("Could not save this pot’s settings.", 502);
  }

  if (!response.ok) {
    console.error("Pot metadata database request failed", response.status);
    throw new PotMetadataError("Could not save this pot’s settings.", 502);
  }
  if (response.status === 204) return null;

  try {
    return await response.json() as unknown;
  } catch (error) {
    console.error(
      "Pot metadata database returned invalid JSON",
      error instanceof Error ? error.name : "Unknown error",
    );
    throw new PotMetadataError("Could not save this pot’s settings.", 502);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonceRow(value: unknown): value is NonceRow {
  return (
    isRecord(value) &&
    typeof value.nonce === "string" &&
    typeof value.wallet_address === "string" &&
    typeof value.pot_address === "string" &&
    typeof value.origin === "string" &&
    typeof value.message === "string" &&
    typeof value.expires_at === "string"
  );
}

export function isMetadataAddress(value: unknown): value is string {
  return typeof value === "string" && isAddress(value);
}

export async function createPotMetadataChallenge(
  walletInput: string,
  potInput: string,
  origin: string,
  description: string,
  isPublic = true,
  accessKeyHash: string | null = null,
): Promise<{ nonce: string; message: string; expiresAt: string }> {
  if (!isAddress(walletInput) || !isAddress(potInput)) {
    throw new PotMetadataError("A valid wallet and pot address are required.", 400);
  }
  if (
    typeof description !== "string" ||
    Array.from(description).length > maxDescriptionLength
  ) {
    throw new PotMetadataError("Description must be at most 2,000 characters.", 400);
  }
  if (
    typeof isPublic !== "boolean" ||
    (isPublic && accessKeyHash !== null) ||
    (!isPublic && (typeof accessKeyHash !== "string" || !/^[0-9a-f]{64}$/.test(accessKeyHash)))
  ) {
    throw new PotMetadataError("Choose valid pot privacy settings.", 400);
  }
  const walletAddress = getAddress(walletInput);
  const potAddress = getAddress(potInput);
  const normalizedDescription = description.trim();
  const environment = getEnvironment();
  const organizer = await getVerifiedOrganizer(environment, potAddress);
  if (organizer.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new PotMetadataError("Only this pot’s onchain organizer can publish its description.", 403);
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + nonceLifetimeMs);
  const nonce = randomBytes(16).toString("hex");
  const uri = new URL(`/pot/${potAddress.toLowerCase()}`, origin).toString();
  const authorizationStatement = getMetadataAuthorizationStatement(
    potAddress,
    normalizedDescription,
    isPublic,
    accessKeyHash,
  );
  const message = `${new URL(origin).host} wants you to sign in with your Ethereum account:
${walletAddress}

${authorizationStatement}

URI: ${uri}
Version: 1
Chain ID: ${baseSepolia.id}
Nonce: ${nonce}
Issued At: ${issuedAt.toISOString()}
Expiration Time: ${expiresAt.toISOString()}`;

  const issued = await supabaseRequest(
    environment,
    "rpc/issue_pot_metadata_nonce",
    {
      method: "POST",
      body: JSON.stringify({
        p_nonce: nonce,
        p_wallet_address: walletAddress.toLowerCase(),
        p_pot_address: potAddress.toLowerCase(),
        p_origin: origin,
        p_message: message,
        p_expires_at: expiresAt.toISOString(),
      }),
    },
  );
  if (issued !== true) {
    throw new PotMetadataError("Too many metadata authorization requests. Try again shortly.", 429);
  }

  return { nonce, message, expiresAt: expiresAt.toISOString() };
}

function getMetadataAuthorizationStatement(
  potAddress: string,
  description: string,
  isPublic: boolean,
  accessKeyHash: string | null,
): string {
  return `Authorize updating pot visibility and description for pot ${potAddress}: ` +
    JSON.stringify({
      description,
      visibility: isPublic ? "public" : "private",
      accessKeyHash,
    });
}

function hashAccessKey(accessKey: string): string {
  return createHash("sha256").update(accessKey, "utf8").digest("hex");
}

export async function publishPotDescription(input: {
  walletAddress: string;
  potAddress: string;
  nonce: string;
  signature: string;
  description: string;
  isPublic?: boolean;
  accessKey?: string | null;
  origin: string;
}): Promise<void> {
  if (!isAddress(input.walletAddress) || !isAddress(input.potAddress)) {
    throw new PotMetadataError("A valid wallet and pot address are required.", 400);
  }
  if (!/^[0-9a-f]{32}$/.test(input.nonce)) {
    throw new PotMetadataError("The metadata authorization challenge is invalid.", 400);
  }
  if (!isHex(input.signature) || input.signature.length !== 132) {
    throw new PotMetadataError("A valid wallet signature is required.", 400);
  }
  if (
    typeof input.description !== "string" ||
    Array.from(input.description).length > maxDescriptionLength
  ) {
    throw new PotMetadataError("Description must be at most 2,000 characters.", 400);
  }
  const isPublic = input.isPublic ?? true;
  const accessKey = input.accessKey ?? null;
  if (
    typeof isPublic !== "boolean" ||
    (isPublic && accessKey !== null) ||
    (!isPublic &&
      (typeof accessKey !== "string" || !/^[0-9a-f]{64}$/.test(accessKey)))
  ) {
    throw new PotMetadataError("Choose valid pot privacy settings.", 400);
  }

  const walletAddress = getAddress(input.walletAddress);
  const potAddress = getAddress(input.potAddress);
  const accessKeyHash = accessKey === null ? null : hashAccessKey(accessKey);
  const environment = getEnvironment();
  const nonceParameters = new URLSearchParams({
    select: "nonce,wallet_address,pot_address,origin,message,expires_at",
    nonce: `eq.${input.nonce}`,
    consumed_at: "is.null",
    limit: "1",
  });
  const nonceRows = await supabaseRequest(
    environment,
    `pot_metadata_nonces?${nonceParameters.toString()}`,
  );
  if (!Array.isArray(nonceRows) || !isNonceRow(nonceRows[0])) {
    throw new PotMetadataError("The metadata authorization expired or was already used.", 401);
  }

  const challenge = nonceRows[0];
  const authorizationStatement = getMetadataAuthorizationStatement(
    potAddress,
    input.description.trim(),
    isPublic,
    accessKeyHash,
  );
  if (
    challenge.wallet_address !== walletAddress.toLowerCase() ||
    challenge.pot_address !== potAddress.toLowerCase() ||
    challenge.origin !== input.origin ||
    !challenge.message.includes(`${authorizationStatement}\n\nURI:`) ||
    Date.parse(challenge.expires_at) <= Date.now()
  ) {
    throw new PotMetadataError("The metadata authorization expired or does not match this request.", 401);
  }

  const client = getPublicClient(environment);
  let signatureValid: boolean;
  try {
    signatureValid = await client.verifyMessage({
      address: walletAddress,
      message: challenge.message,
      signature: input.signature,
    });
  } catch (error) {
    console.error(
      "Could not verify pot metadata wallet signature",
      error instanceof Error ? error.name : "Unknown error",
    );
    throw new PotMetadataError("Could not verify the wallet signature on Base Sepolia.", 502);
  }
  if (!signatureValid) {
    throw new PotMetadataError("The wallet signature does not authorize this update.", 401);
  }

  const organizer = await getVerifiedOrganizer(environment, potAddress);
  if (organizer.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new PotMetadataError("Only this pot’s onchain organizer can publish its description.", 403);
  }

  const potParameters = new URLSearchParams({
    select: "address",
    chain_id: `eq.${baseSepolia.id}`,
    address: `eq.${potAddress.toLowerCase()}`,
    organizer: `eq.${walletAddress.toLowerCase()}`,
    limit: "1",
  });
  const indexedPots = await supabaseRequest(
    environment,
    `pots?${potParameters.toString()}`,
  );
  if (!Array.isArray(indexedPots) || indexedPots.length === 0) {
    throw new PotMetadataError(
      "This pot is not indexed yet. Wait for indexing, then sign again to save its settings.",
      409,
    );
  }

  const consumeParameters = new URLSearchParams({
    nonce: `eq.${input.nonce}`,
    wallet_address: `eq.${walletAddress.toLowerCase()}`,
    pot_address: `eq.${potAddress.toLowerCase()}`,
    expires_at: `gt.${new Date().toISOString()}`,
    consumed_at: "is.null",
    select: "nonce",
  });
  const consumed = await supabaseRequest(
    environment,
    `pot_metadata_nonces?${consumeParameters.toString()}`,
    {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ consumed_at: new Date().toISOString() }),
    },
  );
  if (!Array.isArray(consumed) || consumed.length !== 1) {
    throw new PotMetadataError("The metadata authorization expired or was already used.", 401);
  }

  const saved = await supabaseRequest(
    environment,
    "rpc/save_pot_visibility",
    {
      method: "POST",
      body: JSON.stringify({
        p_chain_id: baseSepolia.id,
        p_pot_address: potAddress.toLowerCase(),
        p_organizer: walletAddress.toLowerCase(),
        p_description: input.description.trim(),
        p_is_public: isPublic,
        p_access_key_hash: accessKeyHash,
      }),
    },
  );
  if (saved !== true) {
    throw new PotMetadataError(
      "The pot changed before its settings could be saved. Request a new signature and try again.",
      409,
    );
  }
}

export function isMetadataSignature(value: unknown): value is string {
  return isHex(value) && value.length === 132;
}
