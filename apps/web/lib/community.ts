import "server-only";

import { randomBytes } from "node:crypto";
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  isHex,
  parseAbi,
} from "viem";
import { baseSepolia } from "viem/chains";
import { getSameRequestOrigin } from "./pot-metadata";

const factoryAbi = parseAbi(["function isPot(address pot) view returns (bool)"]);
const potAbi = parseAbi(["function organizer() view returns (address)"]);
const nonceLifetimeMs = 5 * 60 * 1000;
const reactionTypes = ["heart", "celebrate", "support"] as const;
const actionTypes = [
  "pot_update",
  "pot_reaction",
  "organizer_profile",
  "collection_create",
  "collection_delete",
  "collection_assign",
  "collection_unassign",
] as const;

export type CommunityActionType = typeof actionTypes[number];
export type PotReaction = typeof reactionTypes[number];

type CommunityEnvironment = {
  rpcUrl: string;
  factoryAddress: `0x${string}`;
  supabaseUrl: string;
  serviceRoleKey: string;
};

type CommunityAction = {
  walletAddress: `0x${string}`;
  actionType: CommunityActionType;
  target: string;
  payload: Record<string, unknown>;
};

type ActionNonceRow = {
  nonce: string;
  wallet_address: string;
  action_type: CommunityActionType;
  action_target: string;
  action_payload: string;
  origin: string;
  message: string;
  expires_at: string;
};

export class CommunityError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CommunityError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new CommunityError(`Community features are missing ${name}.`, 503);
  return value;
}

function getEnvironment(): CommunityEnvironment {
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
    throw new CommunityError("Community feature configuration is invalid.", 503);
  }
  if (
    parsedRpcUrl.protocol !== "https:" ||
    parsedSupabaseUrl.protocol !== "https:" ||
    parsedSupabaseUrl.username ||
    parsedSupabaseUrl.password ||
    !isAddress(factoryAddress)
  ) {
    throw new CommunityError("Community feature configuration is invalid.", 503);
  }
  return {
    rpcUrl,
    factoryAddress: getAddress(factoryAddress),
    supabaseUrl: parsedSupabaseUrl.toString().replace(/\/+$/, ""),
    serviceRoleKey,
  };
}

async function databaseRequest(
  environment: CommunityEnvironment,
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
    if (init.body !== undefined) headers.set("content-type", "application/json");
    response = await fetch(`${environment.supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    console.error("Could not reach the community database", error instanceof Error ? error.name : "Unknown error");
    throw new CommunityError("Could not save or load community details.", 502);
  }
  if (!response.ok) {
    console.error("Community database request failed", response.status);
    throw new CommunityError("Could not save or load community details.", 502);
  }
  if (response.status === 204) return null;
  try {
    return await response.json() as unknown;
  } catch (error) {
    console.error("Community database returned invalid JSON", error instanceof Error ? error.name : "Unknown error");
    throw new CommunityError("Community data could not be read.", 502);
  }
}

function validatePayload(
  actionType: CommunityActionType,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (actionType === "pot_update") {
    if (typeof payload.body !== "string" || !payload.body.trim() || Array.from(payload.body.trim()).length > 500) {
      throw new CommunityError("An update must be between 1 and 500 characters.", 400);
    }
    return { body: payload.body.trim() };
  }
  if (actionType === "pot_reaction") {
    if (!reactionTypes.includes(payload.reaction as PotReaction)) {
      throw new CommunityError("Choose a supported reaction.", 400);
    }
    return { reaction: payload.reaction };
  }
  if (actionType === "organizer_profile") {
    const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
    const bio = typeof payload.bio === "string" ? payload.bio.trim() : "";
    const accentColor = typeof payload.accentColor === "string" ? payload.accentColor : "";
    if (Array.from(displayName).length > 60 || Array.from(bio).length > 280 || !/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
      throw new CommunityError("Check the profile name, description, and brand color.", 400);
    }
    return { displayName, bio, accentColor: accentColor.toLowerCase() };
  }
  if (actionType === "collection_create") {
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const description = typeof payload.description === "string" ? payload.description.trim() : "";
    if (!name || Array.from(name).length > 60 || Array.from(description).length > 280) {
      throw new CommunityError("Collection names must be 1–60 characters; descriptions can be up to 280.", 400);
    }
    return { name, description };
  }
  if (actionType === "collection_delete") {
    if (typeof payload.collectionId !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.collectionId)) {
      throw new CommunityError("Choose a valid collection.", 400);
    }
    return { collectionId: payload.collectionId };
  }
  if (actionType === "collection_assign" || actionType === "collection_unassign") {
    if (
      typeof payload.collectionId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(payload.collectionId) ||
      typeof payload.potAddress !== "string" ||
      !isAddress(payload.potAddress)
    ) {
      throw new CommunityError("Choose a valid collection and pot.", 400);
    }
    return { collectionId: payload.collectionId, potAddress: getAddress(payload.potAddress).toLowerCase() };
  }
  throw new CommunityError("This community action is not supported.", 400);
}

function isActionType(value: unknown): value is CommunityActionType {
  return typeof value === "string" && actionTypes.includes(value as CommunityActionType);
}

async function getPotOwner(
  environment: CommunityEnvironment,
  potAddress: `0x${string}`,
): Promise<`0x${string}`> {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(environment.rpcUrl),
  });
  let chainId: number;
  try {
    chainId = await client.getChainId();
  } catch (error) {
    console.error("Could not check the community action network", error instanceof Error ? error.name : "Unknown error");
    throw new CommunityError("Could not verify this pot on Base Sepolia.", 502);
  }
  if (chainId !== baseSepolia.id) {
    throw new CommunityError(`Configured RPC returned chain ID ${chainId}, expected 84532.`, 503);
  }
  try {
    const [isPot, organizer] = await Promise.all([
      client.readContract({
        address: environment.factoryAddress,
        abi: factoryAbi,
        functionName: "isPot",
        args: [potAddress],
      }),
      client.readContract({ address: potAddress, abi: potAbi, functionName: "organizer" }),
    ]);
    if (!isPot) throw new CommunityError("This pot is not registered in the configured factory.", 404);
    return organizer;
  } catch (error) {
    if (error instanceof CommunityError) throw error;
    console.error("Could not verify community pot ownership", error instanceof Error ? error.name : "Unknown error");
    throw new CommunityError("Could not verify this pot on Base Sepolia.", 502);
  }
}

async function requirePublicPot(
  environment: CommunityEnvironment,
  potAddress: string,
): Promise<`0x${string}`> {
  if (!isAddress(potAddress)) throw new CommunityError("A valid pot address is required.", 400);
  const address = getAddress(potAddress);
  const parameters = new URLSearchParams({
    select: "address",
    chain_id: `eq.${baseSepolia.id}`,
    address: `eq.${address.toLowerCase()}`,
    is_public: "eq.true",
    limit: "1",
  });
  const rows = await databaseRequest(environment, `pots?${parameters.toString()}`);
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new CommunityError("This public pot is not indexed yet.", 404);
  }
  return address;
}

function validateAction(value: unknown): CommunityAction {
  if (
    !isRecord(value) ||
    typeof value.walletAddress !== "string" ||
    !isAddress(value.walletAddress) ||
    !isActionType(value.actionType) ||
    typeof value.target !== "string" ||
    !isRecord(value.payload)
  ) {
    throw new CommunityError("The signed action is invalid.", 400);
  }
  return {
    walletAddress: getAddress(value.walletAddress),
    actionType: value.actionType,
    target: value.target,
    payload: validatePayload(value.actionType, value.payload),
  };
}

function getActionStatement(action: CommunityAction): string {
  return `Authorize POT action ${action.actionType} for ${action.target}: ${JSON.stringify(action.payload)}`;
}

function getActionMessage(origin: string, nonce: string, expiresAt: Date, action: CommunityAction): string {
  const issuedAt = new Date(expiresAt.getTime() - nonceLifetimeMs);
  return `${new URL(origin).host} wants you to sign in with your Ethereum account:
${action.walletAddress}

${getActionStatement(action)}

URI: ${new URL("/", origin).toString()}
Version: 1
Chain ID: ${baseSepolia.id}
Nonce: ${nonce}
Issued At: ${issuedAt.toISOString()}
Expiration Time: ${expiresAt.toISOString()}`;
}

export async function createCommunityChallenge(
  actionInput: unknown,
  origin: string,
): Promise<{ nonce: string; message: string; expiresAt: string }> {
  const action = validateAction(actionInput);
  const environment = getEnvironment();
  if (action.actionType === "pot_update" || action.actionType === "pot_reaction") {
    await requirePublicPot(environment, action.target);
    if (action.actionType === "pot_update") {
      const owner = await getPotOwner(environment, getAddress(action.target));
      if (owner.toLowerCase() !== action.walletAddress.toLowerCase()) {
        throw new CommunityError("Only this pot’s organizer can post an update.", 403);
      }
    }
  }
  if (action.actionType === "collection_assign" || action.actionType === "collection_unassign") {
    const potAddress = action.payload.potAddress;
    if (typeof potAddress !== "string") throw new CommunityError("A valid public pot is required.", 400);
    const owner = await getPotOwner(environment, getAddress(potAddress));
    if (owner.toLowerCase() !== action.walletAddress.toLowerCase()) {
      throw new CommunityError("You can only manage pots created by this wallet.", 403);
    }
    await requirePublicPot(environment, potAddress);
  }
  const expiresAt = new Date(Date.now() + nonceLifetimeMs);
  const nonce = randomBytes(16).toString("hex");
  const message = getActionMessage(origin, nonce, expiresAt, action);
  const inserted = await databaseRequest(environment, "rpc/issue_app_action_nonce", {
    method: "POST",
    body: JSON.stringify({
      p_nonce: nonce,
      p_wallet_address: action.walletAddress.toLowerCase(),
      p_action_type: action.actionType,
      p_action_target: action.target,
      p_action_payload: JSON.stringify(action.payload),
      p_origin: origin,
      p_message: message,
      p_expires_at: expiresAt.toISOString(),
    }),
  });
  if (inserted !== true) {
    throw new CommunityError("Too many signed actions. Wait a few minutes and try again.", 429);
  }
  return { nonce, message, expiresAt: expiresAt.toISOString() };
}

function isActionNonceRow(value: unknown): value is ActionNonceRow {
  return (
    isRecord(value) &&
    typeof value.nonce === "string" &&
    typeof value.wallet_address === "string" &&
    isActionType(value.action_type) &&
    typeof value.action_target === "string" &&
    typeof value.action_payload === "string" &&
    typeof value.origin === "string" &&
    typeof value.message === "string" &&
    typeof value.expires_at === "string"
  );
}

async function verifyAndConsumeAction(
  action: CommunityAction,
  nonce: string,
  signature: string,
  origin: string,
  environment: CommunityEnvironment,
): Promise<void> {
  if (!/^[0-9a-f]{32}$/.test(nonce) || !isHex(signature) || signature.length !== 132) {
    throw new CommunityError("The signed action is missing a valid nonce or wallet signature.", 400);
  }
  const parameters = new URLSearchParams({
    select: "nonce,wallet_address,action_type,action_target,action_payload,origin,message,expires_at",
    nonce: `eq.${nonce}`,
    consumed_at: "is.null",
    limit: "1",
  });
  const rows = await databaseRequest(environment, `app_action_nonces?${parameters.toString()}`);
  if (!Array.isArray(rows) || !isActionNonceRow(rows[0])) {
    throw new CommunityError("This wallet confirmation expired or has already been used.", 401);
  }
  const challenge = rows[0];
  if (
    challenge.wallet_address !== action.walletAddress.toLowerCase() ||
    challenge.action_type !== action.actionType ||
    challenge.action_target !== action.target ||
    challenge.action_payload !== JSON.stringify(action.payload) ||
    challenge.origin !== origin ||
    !challenge.message.includes(`${getActionStatement(action)}\n\nURI:`) ||
    Date.parse(challenge.expires_at) <= Date.now()
  ) {
    throw new CommunityError("The wallet confirmation does not match this action.", 401);
  }
  const client = createPublicClient({ chain: baseSepolia, transport: http(environment.rpcUrl) });
  let valid: boolean;
  try {
    valid = await client.verifyMessage({
      address: action.walletAddress,
      message: challenge.message,
      signature: signature as `0x${string}`,
    });
  } catch (error) {
    console.error("Could not verify community wallet signature", error instanceof Error ? error.name : "Unknown error");
    throw new CommunityError("Could not verify the wallet signature.", 502);
  }
  if (!valid) throw new CommunityError("The wallet signature does not authorize this action.", 401);

  const consumed = await databaseRequest(
    environment,
    `app_action_nonces?nonce=eq.${nonce}&wallet_address=eq.${action.walletAddress.toLowerCase()}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&consumed_at=is.null&select=nonce`,
    {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ consumed_at: new Date().toISOString() }),
    },
  );
  if (!Array.isArray(consumed) || consumed.length !== 1) {
    throw new CommunityError("This wallet confirmation expired or has already been used.", 401);
  }
}

export async function applyCommunityAction(input: {
  action: unknown;
  nonce: unknown;
  signature: unknown;
  origin: string;
}): Promise<{ success: true; collectionId?: string }> {
  const action = validateAction(input.action);
  if (typeof input.nonce !== "string" || typeof input.signature !== "string") {
    throw new CommunityError("A wallet confirmation is required.", 400);
  }
  const environment = getEnvironment();
  if (action.actionType === "pot_update" || action.actionType === "pot_reaction") {
    await requirePublicPot(environment, action.target);
    if (action.actionType === "pot_update") {
      const owner = await getPotOwner(environment, getAddress(action.target));
      if (owner.toLowerCase() !== action.walletAddress.toLowerCase()) {
        throw new CommunityError("Only this pot’s organizer can post an update.", 403);
      }
    }
  }
  if (action.actionType === "collection_assign" || action.actionType === "collection_unassign") {
    const potAddress = action.payload.potAddress;
    if (typeof potAddress !== "string") throw new CommunityError("A valid pot is required.", 400);
    const owner = await getPotOwner(environment, getAddress(potAddress));
    if (owner.toLowerCase() !== action.walletAddress.toLowerCase()) {
      throw new CommunityError("You can only manage pots created by this wallet.", 403);
    }
    await requirePublicPot(environment, potAddress);
  }
  await verifyAndConsumeAction(action, input.nonce, input.signature, input.origin, environment);
  const wallet = action.walletAddress.toLowerCase();

  if (action.actionType === "pot_update") {
    const inserted = await databaseRequest(environment, "pot_updates", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        chain_id: baseSepolia.id,
        pot_address: action.target.toLowerCase(),
        organizer: wallet,
        body: action.payload.body,
      }),
    });
    if (!Array.isArray(inserted) || inserted.length !== 1) {
      throw new CommunityError("Could not publish this update.", 502);
    }
  } else if (action.actionType === "pot_reaction") {
    const parameters = new URLSearchParams({
      chain_id: `eq.${baseSepolia.id}`,
      pot_address: `eq.${action.target.toLowerCase()}`,
      wallet_address: `eq.${wallet}`,
      select: "reaction",
      limit: "1",
    });
    const current = await databaseRequest(environment, `pot_reactions?${parameters.toString()}`);
    if (!Array.isArray(current)) throw new CommunityError("Could not update this reaction.", 502);
    if (isRecord(current[0]) && current[0].reaction === action.payload.reaction) {
      await databaseRequest(
        environment,
        `pot_reactions?chain_id=eq.${baseSepolia.id}&pot_address=eq.${action.target.toLowerCase()}&wallet_address=eq.${wallet}`,
        { method: "DELETE" },
      );
    } else {
      await databaseRequest(
        environment,
        "pot_reactions?on_conflict=chain_id,pot_address,wallet_address",
        {
          method: "POST",
          headers: { prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            chain_id: baseSepolia.id,
            pot_address: action.target.toLowerCase(),
            wallet_address: wallet,
            reaction: action.payload.reaction,
          }),
        },
      );
    }
  } else if (action.actionType === "organizer_profile") {
    await databaseRequest(environment, "organizer_profiles?on_conflict=wallet_address", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        wallet_address: wallet,
        display_name: action.payload.displayName,
        bio: action.payload.bio,
        accent_color: action.payload.accentColor,
        updated_at: new Date().toISOString(),
      }),
    });
  } else if (action.actionType === "collection_create") {
    const result = await databaseRequest(environment, "creator_collections", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        organizer: wallet,
        name: action.payload.name,
        description: action.payload.description,
      }),
    });
    if (!Array.isArray(result) || !isRecord(result[0]) || typeof result[0].id !== "string") {
      throw new CommunityError("Could not create this collection.", 502);
    }
    return { success: true, collectionId: result[0].id };
  } else if (action.actionType === "collection_delete") {
    const params = new URLSearchParams({
      id: `eq.${action.payload.collectionId}`,
      organizer: `eq.${wallet}`,
    });
    await databaseRequest(environment, `creator_collections?${params.toString()}`, { method: "DELETE" });
  } else {
    const collectionId = action.payload.collectionId;
    const params = new URLSearchParams({
      id: `eq.${String(collectionId)}`,
      organizer: `eq.${wallet}`,
      select: "id",
      limit: "1",
    });
    const owned = await databaseRequest(environment, `creator_collections?${params.toString()}`);
    if (!Array.isArray(owned) || owned.length !== 1) {
      throw new CommunityError("This collection does not belong to the connected wallet.", 403);
    }
    const potAddress = String(action.payload.potAddress);
    if (action.actionType === "collection_assign") {
      await databaseRequest(environment, "creator_collection_pots?on_conflict=collection_id,chain_id,pot_address", {
        method: "POST",
        headers: { prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          collection_id: collectionId,
          chain_id: baseSepolia.id,
          pot_address: potAddress,
        }),
      });
    } else {
      await databaseRequest(
        environment,
        `creator_collection_pots?collection_id=eq.${String(collectionId)}&chain_id=eq.${baseSepolia.id}&pot_address=eq.${potAddress}`,
        { method: "DELETE" },
      );
    }
  }
  return { success: true };
}

export function getCommunityRequestOrigin(request: Request): string {
  return getSameRequestOrigin(request);
}

export function isCommunityAddress(value: unknown): value is string {
  return typeof value === "string" && isAddress(value);
}

export async function getPotCommunity(potInput: string, walletInput?: string) {
  const environment = getEnvironment();
  const potAddress = await requirePublicPot(environment, potInput);
  const params = new URLSearchParams({
    select: "id,organizer,body,created_at",
    chain_id: `eq.${baseSepolia.id}`,
    pot_address: `eq.${potAddress.toLowerCase()}`,
    order: "created_at.desc",
    limit: "25",
  });
  const [updates, reactions] = await Promise.all([
    databaseRequest(environment, `pot_updates?${params.toString()}`),
    databaseRequest(
      environment,
      "rpc/get_pot_reaction_summary",
      {
        method: "POST",
        body: JSON.stringify({
          p_chain_id: baseSepolia.id,
          p_pot_address: potAddress.toLowerCase(),
          p_wallet_address: walletInput?.toLowerCase() ?? null,
        }),
      },
    ),
  ]);
  if (!Array.isArray(updates) || !Array.isArray(reactions)) {
    throw new CommunityError("Could not load this pot’s community activity.", 502);
  }
  if (
    reactions.length !== reactionTypes.length ||
    reactions.some(
      (row) =>
        !isRecord(row) ||
        !reactionTypes.includes(row.reaction as PotReaction) ||
        (typeof row.reaction_count !== "string" && typeof row.reaction_count !== "number") ||
        !/^\d+$/.test(String(row.reaction_count)) ||
        typeof row.selected !== "boolean",
    )
  ) {
    throw new CommunityError("Community reactions were returned in an invalid format.", 502);
  }
  const counts: Record<PotReaction, number> = { heart: 0, celebrate: 0, support: 0 };
  let myReaction: PotReaction | null = null;
  for (const row of reactions) {
    if (!isRecord(row)) throw new CommunityError("Community reactions were returned in an invalid format.", 502);
    counts[row.reaction as PotReaction] = Math.min(Number(row.reaction_count), Number.MAX_SAFE_INTEGER);
    if (row.selected === true) myReaction = row.reaction as PotReaction;
  }
  return {
    updates: updates.flatMap((row) =>
      isRecord(row) &&
      typeof row.id === "string" &&
      typeof row.organizer === "string" &&
      typeof row.body === "string" &&
      typeof row.created_at === "string"
        ? [{ id: row.id, organizer: row.organizer, body: row.body, createdAt: row.created_at }]
        : [],
    ),
    reactions: counts,
    myReaction,
  };
}

export async function getOrganizerWorkspace(walletInput: string) {
  if (!isAddress(walletInput)) throw new CommunityError("This wallet address is not valid.", 400);
  const wallet = getAddress(walletInput).toLowerCase();
  const environment = getEnvironment();
  const [profiles, collections] = await Promise.all([
    databaseRequest(
      environment,
      `organizer_profiles?select=wallet_address,display_name,bio,accent_color&wallet_address=eq.${wallet}&limit=1`,
    ),
    databaseRequest(
      environment,
      `creator_collections?select=id,organizer,name,description,created_at&organizer=eq.${wallet}&order=created_at.desc`,
    ),
  ]);
  if (!Array.isArray(profiles) || !Array.isArray(collections)) {
    throw new CommunityError("Could not load organizer tools.", 502);
  }
  const collectionIds = collections.flatMap((row) =>
    isRecord(row) && typeof row.id === "string" ? [row.id] : [],
  );
  const assignments = collectionIds.length
    ? await databaseRequest(
        environment,
        `creator_collection_pots?select=collection_id,pot_address&collection_id=in.(${collectionIds.join(",")})`,
      )
    : [];
  if (!Array.isArray(assignments)) throw new CommunityError("Could not load organizer collections.", 502);
  const assignedAddresses = [...new Set(assignments.flatMap((item) =>
    isRecord(item) && typeof item.pot_address === "string" && isAddress(item.pot_address)
      ? [getAddress(item.pot_address).toLowerCase()]
      : [],
  ))];
  const publicRows = assignedAddresses.length
    ? await databaseRequest(
        environment,
        `pots?select=address&chain_id=eq.${baseSepolia.id}&is_public=eq.true&address=in.(${assignedAddresses.join(",")})`,
      )
    : [];
  if (!Array.isArray(publicRows)) throw new CommunityError("Could not load public collection pots.", 502);
  const publicAddresses = new Set(publicRows.flatMap((row) =>
    isRecord(row) && typeof row.address === "string" && isAddress(row.address)
      ? [row.address.toLowerCase()]
      : [],
  ));
  const profile = isRecord(profiles[0]) ? profiles[0] : null;
  return {
    profile: profile && typeof profile.display_name === "string"
      ? {
          displayName: profile.display_name,
          bio: typeof profile.bio === "string" ? profile.bio : "",
          accentColor: typeof profile.accent_color === "string" ? profile.accent_color : "#087a3e",
        }
      : { displayName: "", bio: "", accentColor: "#087a3e" },
    collections: collections.flatMap((row) => {
      if (
        !isRecord(row) ||
        typeof row.id !== "string" ||
        typeof row.name !== "string" ||
        typeof row.description !== "string"
      ) return [];
      return [{
        id: row.id,
        name: row.name,
        description: row.description,
        potAddresses: assignments.flatMap((item) =>
          isRecord(item) &&
          item.collection_id === row.id &&
          typeof item.pot_address === "string" &&
          isAddress(item.pot_address) &&
          publicAddresses.has(item.pot_address.toLowerCase())
            ? [getAddress(item.pot_address)]
            : [],
        ),
      }];
    }),
  };
}

export async function getPublicOrganizerProfile(walletInput: string) {
  if (!isAddress(walletInput)) throw new CommunityError("This wallet address is not valid.", 400);
  const wallet = getAddress(walletInput);
  const environment = getEnvironment();
  const [profiles, collections] = await Promise.all([
    databaseRequest(
      environment,
      `organizer_profiles?select=display_name,bio,accent_color&wallet_address=eq.${wallet.toLowerCase()}&limit=1`,
    ),
    databaseRequest(
      environment,
      `creator_collections?select=id,name,description&organizer=eq.${wallet.toLowerCase()}&order=created_at.desc`,
    ),
  ]);
  if (!Array.isArray(profiles) || !Array.isArray(collections)) {
    throw new CommunityError("Could not load this organizer’s page.", 502);
  }
  const collectionIds = collections.flatMap((row) =>
    isRecord(row) && typeof row.id === "string" ? [row.id] : [],
  );
  const assignments = collectionIds.length
    ? await databaseRequest(
        environment,
        `creator_collection_pots?select=collection_id,pot_address&collection_id=in.(${collectionIds.join(",")})`,
      )
    : [];
  if (!Array.isArray(assignments)) {
    throw new CommunityError("Could not load this organizer’s collections.", 502);
  }
  const assignedAddresses = [...new Set(assignments.flatMap((row) =>
    isRecord(row) && typeof row.pot_address === "string" && isAddress(row.pot_address)
      ? [getAddress(row.pot_address).toLowerCase()]
      : [],
  ))];
  const publicPots = assignedAddresses.length
    ? await databaseRequest(
        environment,
        `pots?select=address,name,description&chain_id=eq.${baseSepolia.id}&is_public=eq.true&address=in.(${assignedAddresses.join(",")})`,
      )
    : [];
  if (!Array.isArray(publicPots)) throw new CommunityError("Could not load this organizer’s public pots.", 502);
  const publicPotMap = new Map(
    publicPots.flatMap((row) =>
      isRecord(row) &&
      typeof row.address === "string" &&
      isAddress(row.address) &&
      typeof row.name === "string" &&
      typeof row.description === "string"
        ? [[row.address.toLowerCase(), {
            address: getAddress(row.address),
            name: row.name,
            description: row.description,
          }] as const]
        : [],
    ),
  );
  const profile = isRecord(profiles[0]) ? profiles[0] : null;
  return {
    walletAddress: wallet,
    profile: {
      displayName: profile && typeof profile.display_name === "string" ? profile.display_name : "",
      bio: profile && typeof profile.bio === "string" ? profile.bio : "",
      accentColor: profile && typeof profile.accent_color === "string" ? profile.accent_color : "#087a3e",
    },
    collections: collections.flatMap((row) => {
      if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string" || typeof row.description !== "string") {
        return [];
      }
      return [{
        id: row.id,
        name: row.name,
        description: row.description,
        pots: assignments.flatMap((assignment) =>
          isRecord(assignment) &&
          assignment.collection_id === row.id &&
          typeof assignment.pot_address === "string"
            ? [publicPotMap.get(assignment.pot_address.toLowerCase())].filter(
                (pot): pot is { address: `0x${string}`; name: string; description: string } =>
                  pot !== undefined,
              )
            : [],
        ),
      }];
    }),
  };
}
