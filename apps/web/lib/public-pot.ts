import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
} from "viem";
import { baseSepolia } from "viem/chains";
import { circleBaseSepoliaUsdc } from "./pot-factory";

const potFactoryAbi = parseAbi([
  "function isPot(address pot) view returns (bool)",
  "function token() view returns (address)",
]);

const potAbi = parseAbi([
  "function token() view returns (address)",
  "function organizer() view returns (address)",
  "function payoutRecipient() view returns (address)",
  "function fundingMode() view returns (uint8)",
  "function targetBased() view returns (bool)",
  "function targetAmount() view returns (uint256)",
  "function deadline() view returns (uint64)",
  "function minimumContribution() view returns (uint256)",
  "function name() view returns (string)",
  "function metadataURI() view returns (string)",
  "function totalContributed() view returns (uint256)",
  "function totalRefunded() view returns (uint256)",
  "function totalPaidOut() view returns (uint256)",
  "function paidOut() view returns (bool)",
  "function isContributionOpen() view returns (bool)",
  "function isPayoutEligible() view returns (bool)",
  "function isRefundEligible() view returns (bool)",
]);

const tokenAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address account) view returns (uint256)",
]);

const MAX_PAGE_SIZE = 25;
const MAX_CONTRIBUTION_EVENT_PAGE_SIZE = 250;
const potBalanceAbi = parseAbi(["function token() view returns (address)"]);
const potContributionAbi = parseAbi([
  "function contributions(address contributor) view returns (uint256)",
]);

export class PublicPotError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PublicPotError";
  }
}

function isContributionSearchRows(value: unknown): value is ContributionSearchRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        isRecord(row) &&
        typeof row.pot_address === "string" &&
        /^0x[\da-fA-F]{40}$/.test(row.pot_address) &&
        typeof row.block_number === "string" &&
        /^\d+$/.test(row.block_number) &&
        isRecord(row.event_data) &&
        typeof row.event_data.contributor === "string" &&
        /^0x[\da-fA-F]{40}$/.test(row.event_data.contributor),
    )
  );
}

export type PublicPotEvent = {
  transactionHash: `0x${string}`;
  logIndex: number;
  blockNumber: string;
  eventName: string;
  eventData: Record<string, unknown>;
};

type ContributionSearchRow = {
  pot_address: `0x${string}`;
  block_number: string;
  event_data: Record<string, unknown> & { contributor: string };
};

export type PublicOrganizerPot = {
  address: `0x${string}`;
  name: string;
  fundingMode: number;
  targetBased: boolean;
  createdBlock: string;
  escrowBalance: string;
  totalContributed: string;
  contributionOpen: boolean;
  paidOut: boolean;
};

export type PublicParticipatedPot = PublicOrganizerPot & {
  lastContributionBlock: string;
  contributedAmount: string;
};

export type PublicDiscoveryPot = {
  address: `0x${string}`;
  organizer: `0x${string}`;
  name: string;
  description: string;
  coverImageUrl: string | null;
  targetAmount: string;
  deadline: string;
  createdBlock: string;
  fundingMode: number;
  escrowBalance: string;
  totalContributed: string;
  contributionOpen: boolean;
};

export type PublicPotDetails = {
  address: `0x${string}`;
  chainId: number;
  organizer: `0x${string}`;
  payoutRecipient: `0x${string}`;
  fundingMode: number;
  token: `0x${string}`;
  name: string;
  metadataURI: string;
  description: string;
  coverImageUrl: string | null;
  isPublic: boolean;
  targetBased: boolean;
  targetAmount: string;
  deadline: string;
  minimumContribution: string;
  totalContributed: string;
  totalRefunded: string;
  totalPaidOut: string;
  currentBalance: string;
  tokenDecimals: number;
  tokenSymbol: string;
  paidOut: boolean;
  contributionOpen: boolean;
  payoutEligible: boolean;
  refundEligible: boolean;
  explorerUrl: string;
  events: PublicPotEvent[];
};

type Environment = {
  rpcUrl: string;
  factoryAddress: `0x${string}`;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type PotMetadataRow = {
  description: string;
  cover_image_url: string | null;
  is_public: boolean;
};

type PrivatePotAccessRow = {
  access_key_hash: string;
};

type PotEventRow = {
  transaction_hash: `0x${string}`;
  log_index: number;
  block_number: string;
  event_name: "PotCreated" | "ContributionMade" | "PotPaidOut" | "ContributionRefunded";
  event_data: Record<string, unknown>;
};

type OrganizerPotRow = {
  address: `0x${string}`;
  name: string;
  target_based: boolean;
  created_block: string;
};

type PublicDiscoveryPotRow = {
  address: `0x${string}`;
  organizer: `0x${string}`;
  name: string;
  description: string;
  cover_image_url: string | null;
  target_amount: string;
  deadline: string;
  created_block: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMetadataRows(value: unknown): value is PotMetadataRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        isRecord(row) &&
        typeof row.description === "string" &&
        (typeof row.cover_image_url === "string" || row.cover_image_url === null) &&
        typeof row.is_public === "boolean",
    )
  );
}

function isPrivatePotAccessRows(value: unknown): value is PrivatePotAccessRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        isRecord(row) &&
        typeof row.access_key_hash === "string" &&
        /^[0-9a-f]{64}$/.test(row.access_key_hash),
    )
  );
}

function isEventRows(value: unknown): value is PotEventRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        isRecord(row) &&
        typeof row.transaction_hash === "string" &&
        /^0x[\da-fA-F]{64}$/.test(row.transaction_hash) &&
        Number.isInteger(row.log_index) &&
        typeof row.block_number === "string" &&
        /^\d+$/.test(row.block_number) &&
        (row.event_name === "PotCreated" ||
          row.event_name === "ContributionMade" ||
          row.event_name === "PotPaidOut" ||
          row.event_name === "ContributionRefunded") &&
        isRecord(row.event_data),
    )
  );
}

function isOrganizerPotRows(value: unknown): value is OrganizerPotRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        isRecord(row) &&
        typeof row.address === "string" &&
        /^0x[\da-fA-F]{40}$/.test(row.address) &&
        typeof row.name === "string" &&
        typeof row.target_based === "boolean" &&
        typeof row.created_block === "string" &&
        /^\d+$/.test(row.created_block),
    )
  );
}

function isPublicDiscoveryPotRows(value: unknown): value is PublicDiscoveryPotRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        isRecord(row) &&
        typeof row.address === "string" &&
        /^0x[\da-fA-F]{40}$/.test(row.address) &&
        typeof row.organizer === "string" &&
        /^0x[\da-fA-F]{40}$/.test(row.organizer) &&
        typeof row.name === "string" &&
        typeof row.description === "string" &&
        (typeof row.cover_image_url === "string" || row.cover_image_url === null) &&
        typeof row.target_amount === "string" &&
        /^\d+$/.test(row.target_amount) &&
        typeof row.deadline === "string" &&
        /^\d+$/.test(row.deadline) &&
        typeof row.created_block === "string" &&
        /^\d+$/.test(row.created_block),
    )
  );
}

function getEnvironment(): Environment {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL?.trim();
  const factoryAddress = process.env.POT_FACTORY_ADDRESS?.trim();

  if (!rpcUrl || !factoryAddress) {
    throw new PublicPotError("Public pot data is not configured yet.", 503);
  }

  let parsedRpcUrl: URL;
  try {
    parsedRpcUrl = new URL(rpcUrl);
  } catch {
    throw new PublicPotError("Public pot service configuration is invalid.", 503);
  }

  if (
    parsedRpcUrl.protocol !== "https:" ||
    !isAddress(factoryAddress)
  ) {
    throw new PublicPotError("Public pot service configuration is invalid.", 503);
  }

  return {
    rpcUrl,
    factoryAddress: getAddress(factoryAddress),
    ...getSupabaseEnvironment(),
  };
}

function getSupabaseEnvironment(): Pick<Environment, "supabaseUrl" | "supabaseAnonKey"> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new PublicPotError("Public pot metadata is not configured yet.", 503);
  }

  let parsedSupabaseUrl: URL;
  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw new PublicPotError("Public pot service configuration is invalid.", 503);
  }
  if (
    parsedSupabaseUrl.protocol !== "https:" ||
    parsedSupabaseUrl.username ||
    parsedSupabaseUrl.password
  ) {
    throw new PublicPotError("Public pot service configuration is invalid.", 503);
  }

  return {
    supabaseUrl: parsedSupabaseUrl.toString().replace(/\/+$/, ""),
    supabaseAnonKey,
  };
}

async function getVerifiedPotAmounts(
  addresses: readonly `0x${string}`[],
  contributorAddress?: `0x${string}`,
): Promise<
  Map<
    string,
    {
      fundingMode: number;
      escrowBalance: string;
      totalContributed: string;
      contributionOpen: boolean;
      paidOut: boolean;
      contributedAmount?: string;
    }
  >
> {
  const amounts = new Map<
    string,
    {
      fundingMode: number;
      escrowBalance: string;
      totalContributed: string;
      contributionOpen: boolean;
      paidOut: boolean;
      contributedAmount?: string;
    }
  >();
  if (addresses.length === 0) return amounts;

  const environment = getEnvironment();
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(environment.rpcUrl),
  });

  let chainId: number;
  let blockNumber: bigint;
  try {
    [chainId, blockNumber] = await Promise.all([client.getChainId(), client.getBlockNumber()]);
  } catch (error) {
    console.error(
      "Could not read the Base Sepolia dashboard snapshot",
      error instanceof Error ? error.name : "Unknown error",
    );
    throw new PublicPotError("Could not load verified pot amounts from Base Sepolia.", 502);
  }
  if (chainId !== baseSepolia.id) {
    throw new PublicPotError(`Configured RPC returned chain ID ${chainId}, expected 84532.`, 503);
  }

  let tokenAddress: `0x${string}`;
  let decimals: number;
  let symbol: string;
  try {
    [tokenAddress, decimals, symbol] = await Promise.all([
      client.readContract({
        address: environment.factoryAddress,
        abi: potFactoryAbi,
        functionName: "token",
        blockNumber,
      }),
      client.readContract({
        address: circleBaseSepoliaUsdc,
        abi: tokenAbi,
        functionName: "decimals",
        blockNumber,
      }),
      client.readContract({
        address: circleBaseSepoliaUsdc,
        abi: tokenAbi,
        functionName: "symbol",
        blockNumber,
      }),
    ]);
  } catch (error) {
    console.error(
      "Could not verify settlement token for dashboard amounts",
      error instanceof Error ? error.name : "Unknown error",
    );
    throw new PublicPotError("Could not verify Circle USDC on Base Sepolia.", 502);
  }
  if (
    tokenAddress.toLowerCase() !== circleBaseSepoliaUsdc.toLowerCase() ||
    decimals !== 6 ||
    symbol !== "USDC"
  ) {
    throw new PublicPotError(
      "The configured factory or settlement token does not match verified Circle Base Sepolia USDC.",
      503,
    );
  }

  const contracts = addresses.flatMap((address) => [
    {
      address: environment.factoryAddress,
      abi: potFactoryAbi,
      functionName: "isPot" as const,
      args: [address] as const,
    },
    {
      address,
      abi: potAbi,
      functionName: "fundingMode" as const,
    },
    {
      address,
      abi: potBalanceAbi,
      functionName: "token" as const,
    },
    {
      address: circleBaseSepoliaUsdc,
      abi: tokenAbi,
      functionName: "balanceOf" as const,
      args: [address] as const,
    },
    {
      address,
      abi: potAbi,
      functionName: "totalContributed" as const,
    },
    {
      address,
      abi: potAbi,
      functionName: "isContributionOpen" as const,
    },
    {
      address,
      abi: potAbi,
      functionName: "paidOut" as const,
    },
    ...(contributorAddress
      ? [{
          address,
          abi: potContributionAbi,
          functionName: "contributions" as const,
          args: [contributorAddress] as const,
        }]
      : []),
  ]);

  let results: readonly unknown[];
  try {
    results = await client.multicall({
      contracts,
      allowFailure: false,
      blockNumber,
    });
  } catch (error) {
    console.error(
      "Could not read registered pot amounts from Base Sepolia",
      error instanceof Error ? error.name : "Unknown error",
    );
    throw new PublicPotError("Could not load verified pot amounts from Base Sepolia.", 502);
  }

  const stride = contributorAddress ? 8 : 7;
  for (let index = 0; index < addresses.length; index += 1) {
    const offset = index * stride;
    const isRegistered = results[offset];
    const fundingMode = results[offset + 1];
    const potToken = results[offset + 2];
    const escrowBalance = results[offset + 3];
    const totalContributed = results[offset + 4];
    const contributionOpen = results[offset + 5];
    const paidOut = results[offset + 6];
    const contributedAmount = contributorAddress ? results[offset + 7] : undefined;
    if (
      isRegistered !== true ||
      typeof potToken !== "string" ||
      potToken.toLowerCase() !== circleBaseSepoliaUsdc.toLowerCase() ||
      typeof fundingMode !== "number" ||
      !Number.isInteger(fundingMode) ||
      fundingMode < 0 ||
      fundingMode > 3 ||
      typeof escrowBalance !== "bigint" ||
      typeof totalContributed !== "bigint" ||
      typeof contributionOpen !== "boolean" ||
      typeof paidOut !== "boolean" ||
      (contributorAddress && typeof contributedAmount !== "bigint")
    ) {
      throw new PublicPotError(
        "A dashboard pot could not be verified against the configured factory and Circle USDC.",
        502,
      );
    }

    amounts.set(addresses[index].toLowerCase(), {
      fundingMode,
      escrowBalance: escrowBalance.toString(),
      totalContributed: totalContributed.toString(),
      contributionOpen,
      paidOut,
      ...(typeof contributedAmount === "bigint"
        ? { contributedAmount: contributedAmount.toString() }
        : {}),
    });
  }

  return amounts;
}

async function fetchSupabase<T>(
  environment: Pick<Environment, "supabaseUrl" | "supabaseAnonKey">,
  path: string,
  isExpected: (value: unknown) => value is T,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${environment.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: environment.supabaseAnonKey,
      authorization: `Bearer ${environment.supabaseAnonKey}`,
    },
    cache: "no-store",
    });
  } catch (error) {
    console.error("Could not connect to Supabase for public pot data", error);
    throw new PublicPotError("Could not load this pot’s public activity.", 502);
  }

  return readSupabaseResponse(response, isExpected);
}

async function fetchPrivatePotData<T>(
    environment: Pick<Environment, "supabaseUrl">,
    path: string,
    isExpected: (value: unknown) => value is T,
  ): Promise<T> {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      throw new PublicPotError("Private pot access is not configured.", 503);
    }
    let response: Response;
    try {
      const headers = new Headers({ apikey: serviceRoleKey });
      if (!serviceRoleKey.startsWith("sb_secret_")) {
        headers.set("authorization", ["Bearer", serviceRoleKey].join(" "));
      }
      response = await fetch(`${environment.supabaseUrl}/rest/v1/${path}`, {
        headers,
        cache: "no-store",
      });
    } catch (error) {
      console.error("Could not verify private pot access", error instanceof Error ? error.name : "Unknown error");
      throw new PublicPotError("Could not verify access to this pot.", 502);
    }
  return readSupabaseResponse(response, isExpected);
}

async function readSupabaseResponse<T>(
    response: Response,
    isExpected: (value: unknown) => value is T,
): Promise<T> {
    if (!response.ok) {
      console.error("Private pot access query failed", response.status);
      throw new PublicPotError("Could not verify access to this pot.", 502);
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      console.error("Private pot access query returned invalid JSON", error instanceof Error ? error.name : "Unknown error");
      throw new PublicPotError("Could not verify access to this pot.", 502);
    }
    if (!isExpected(data)) {
      console.error("Private pot access query returned an invalid response shape");
      throw new PublicPotError("Could not verify access to this pot.", 502);
    }
    return data;
  }

  async function hashPrivateAccessKey(accessKey: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accessKey));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function hashesMatch(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
  }

function getState(pot: PublicPotDetails) {
  const total = BigInt(pot.totalContributed);
  if (pot.paidOut) return "Paid out";
  if (pot.fundingMode === 2 || pot.fundingMode === 3) {
    if (pot.payoutEligible) return "Ready for payout";
    if (pot.contributionOpen) return "Crowdfunding in progress";
    return "Crowdfunding closed";
  }
  if (pot.refundEligible) return "Refunds available";
  if (pot.targetBased && total >= BigInt(pot.targetAmount)) return "Goal reached";
  if (pot.targetBased && !pot.contributionOpen) return "Funding closed";
  if (pot.targetBased && total === BigInt(0)) return "Awaiting first contribution";
  if (pot.targetBased) return "Funding in progress";
  return "Open pot";
}

export async function getPublicPot(
  addressInput: string,
  privateAccessKey?: string | null,
): Promise<PublicPotDetails> {
  if (!isAddress(addressInput)) {
    throw new PublicPotError("This pot link does not contain a valid address.", 400);
  }

  const address = getAddress(addressInput);
  const environment = getEnvironment();
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(environment.rpcUrl),
  });

  let chainId: number;
  try {
    chainId = await client.getChainId();
  } catch (error) {
    console.error("Could not connect to configured Base Sepolia RPC", error);
    throw new PublicPotError("Could not connect to Base Sepolia right now.", 502);
  }
  if (chainId !== baseSepolia.id) {
    throw new PublicPotError(`Configured RPC returned chain ID ${chainId}, expected 84532.`, 503);
  }

  const blockNumber = await client.getBlockNumber().catch((error: unknown) => {
    console.error("Could not read the Base Sepolia block for a consistent pot snapshot", error);
    throw new PublicPotError("Could not load this pot’s current state.", 502);
  });

  const isRegistered = await client.readContract({
    address: environment.factoryAddress,
    abi: potFactoryAbi,
    functionName: "isPot",
    args: [address],
    blockNumber,
  }).catch((error: unknown) => {
    console.error("Could not check the pot against the configured factory", error);
    throw new PublicPotError("Could not verify this pot on Base Sepolia.", 502);
  });

  if (!isRegistered) throw new PublicPotError("This pot was not found on Base Sepolia.", 404);

  const [
    token,
    organizer,
    payoutRecipient,
    fundingMode,
    targetBased,
    targetAmount,
    deadline,
    minimumContribution,
    name,
    metadataURI,
    totalContributed,
    totalRefunded,
    totalPaidOut,
    paidOut,
    contributionOpen,
    payoutEligible,
    refundEligible,
  ] = await Promise.all([
    client.readContract({ address, abi: potAbi, functionName: "token", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "organizer", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "payoutRecipient", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "fundingMode", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "targetBased", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "targetAmount", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "deadline", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "minimumContribution", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "name", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "metadataURI", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "totalContributed", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "totalRefunded", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "totalPaidOut", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "paidOut", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "isContributionOpen", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "isPayoutEligible", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "isRefundEligible", blockNumber }),
  ]).catch((error: unknown) => {
    console.error("Could not load public pot contract state", error);
    throw new PublicPotError("Could not load this pot’s current contract state.", 502);
  });

  const [tokenDecimals, tokenSymbol, currentBalance] = await Promise.all([
    client.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "decimals",
      blockNumber,
    }),
    client.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "symbol",
      blockNumber,
    }),
    client.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "balanceOf",
      args: [address],
      blockNumber,
    }),
  ]).catch((error: unknown) => {
    console.error("Could not read the configured token metadata", error);
    throw new PublicPotError("Could not read this pot’s token configuration.", 502);
  });
  if (tokenDecimals > 36) {
    throw new PublicPotError("This pot uses an unsupported token decimal configuration.", 502);
  }

  const metadataParameters = new URLSearchParams({
    select: "description,cover_image_url,is_public",
    chain_id: `eq.${baseSepolia.id}`,
    address: `eq.${address.toLowerCase()}`,
    limit: "1",
  });
  const eventParameters = new URLSearchParams({
    select: "transaction_hash,log_index,block_number,event_name,event_data",
    chain_id: `eq.${baseSepolia.id}`,
    pot_address: `eq.${address.toLowerCase()}`,
    order: "block_number.desc,log_index.desc",
    limit: String(MAX_PAGE_SIZE),
  });

  const metadataRows = await fetchPrivatePotData(
    environment,
    `pots?${metadataParameters.toString()}`,
    isMetadataRows,
  );
  const metadata = metadataRows[0];
  if (!metadata) throw new PublicPotError("This pot is not available here.", 404);
  if (!metadata.is_public) {
    if (typeof privateAccessKey !== "string" || !/^[0-9a-f]{64}$/.test(privateAccessKey)) {
      throw new PublicPotError("This pot isn’t available. Check the link with the person who shared it.", 404);
    }
    const accessParameters = new URLSearchParams({
      select: "access_key_hash",
      chain_id: `eq.${baseSepolia.id}`,
      pot_address: `eq.${address.toLowerCase()}`,
      limit: "1",
    });
    const accessRows = await fetchPrivatePotData(
      environment,
      `private_pot_access?${accessParameters.toString()}`,
      isPrivatePotAccessRows,
    );
    const submittedHash = await hashPrivateAccessKey(privateAccessKey);
    if (accessRows.length !== 1 || !hashesMatch(accessRows[0].access_key_hash, submittedHash)) {
      throw new PublicPotError("This pot isn’t available. Check the link with the person who shared it.", 404);
    }
  }
  const eventRows = metadata.is_public
    ? await fetchSupabase(
        environment,
        `pot_events?${eventParameters.toString()}`,
        isEventRows,
      )
    : await fetchPrivatePotData(
        environment,
        `pot_events?${eventParameters.toString()}`,
        isEventRows,
      );
  const explorerUrl = baseSepolia.blockExplorers.default.url;

  return {
    address,
    chainId,
    organizer,
    payoutRecipient,
    fundingMode,
    token,
    name,
    metadataURI,
    description: metadata?.description ?? "",
    coverImageUrl: metadata?.cover_image_url ?? null,
    isPublic: metadata?.is_public ?? false,
    targetBased,
    targetAmount: targetAmount.toString(),
    deadline: deadline.toString(),
    minimumContribution: minimumContribution.toString(),
    totalContributed: totalContributed.toString(),
    totalRefunded: totalRefunded.toString(),
    totalPaidOut: totalPaidOut.toString(),
    currentBalance: currentBalance.toString(),
    tokenDecimals,
    tokenSymbol,
    paidOut,
    contributionOpen,
    payoutEligible,
    refundEligible,
    explorerUrl,
    events: eventRows.map((event) => ({
      transactionHash: event.transaction_hash,
      logIndex: event.log_index,
      blockNumber: event.block_number,
      eventName: event.event_name,
      eventData: event.event_data,
    })),
  };
}

export async function getPublicOrganizerPots(
  organizerInput: string,
): Promise<PublicOrganizerPot[]> {
  if (!isAddress(organizerInput)) {
    throw new PublicPotError("This wallet address is not valid.", 400);
  }

  const environment = getSupabaseEnvironment();
  const parameters = new URLSearchParams({
    select: "address,name,target_based,created_block",
    chain_id: `eq.${baseSepolia.id}`,
    organizer: `eq.${getAddress(organizerInput).toLowerCase()}`,
    is_public: "eq.true",
    order: "created_block.desc",
    limit: String(MAX_PAGE_SIZE),
  });
  const rows = await fetchSupabase(
    environment,
    `pots?${parameters.toString()}`,
    isOrganizerPotRows,
  );

  const addresses = rows.map((row) => getAddress(row.address));
  const amounts = await getVerifiedPotAmounts(addresses);
  return rows.map((row, index) => {
    const address = addresses[index];
    const amount = amounts.get(address.toLowerCase());
    if (!amount) {
      throw new PublicPotError("Could not verify an organizer pot balance on Base Sepolia.", 502);
    }
    return {
      address,
      name: row.name,
      fundingMode: amount.fundingMode,
      targetBased: row.target_based,
      createdBlock: row.created_block,
      escrowBalance: amount.escrowBalance,
      totalContributed: amount.totalContributed,
      contributionOpen: amount.contributionOpen,
      paidOut: amount.paidOut,
    };
  });
}

export async function getPublicDiscoveryPots(queryInput = ""): Promise<PublicDiscoveryPot[]> {
  const query = queryInput.trim();
  if (query.length > 60 || (query && !/^[\p{L}\p{N}\s'-]+$/u.test(query))) {
    throw new PublicPotError("Search using words, numbers, spaces, apostrophes, or hyphens.", 400);
  }
  const environment = getSupabaseEnvironment();
  const parameters = new URLSearchParams({
    select: "address,organizer,name,description,cover_image_url,target_amount,deadline,created_block",
    chain_id: `eq.${baseSepolia.id}`,
    is_public: "eq.true",
    order: "created_block.desc",
    limit: String(MAX_PAGE_SIZE),
  });
  if (query) {
    parameters.set("or", `(name.ilike.*${query}*,description.ilike.*${query}*)`);
  }
  const rows = await fetchSupabase(
    environment,
    `pots?${parameters.toString()}`,
    isPublicDiscoveryPotRows,
  );
  if (rows.length === 0) return [];
  const addresses = rows.map((row) => getAddress(row.address));
  const amounts = await getVerifiedPotAmounts(addresses);
  return rows.map((row, index) => {
    const amount = amounts.get(addresses[index].toLowerCase());
    if (!amount) {
      throw new PublicPotError("A public pot could not be verified against Base Sepolia.", 502);
    }
    return {
      address: addresses[index],
      organizer: getAddress(row.organizer),
      name: row.name,
      description: row.description,
      coverImageUrl: row.cover_image_url,
      targetAmount: row.target_amount,
      deadline: row.deadline,
      createdBlock: row.created_block,
      fundingMode: amount.fundingMode,
      escrowBalance: amount.escrowBalance,
      totalContributed: amount.totalContributed,
      contributionOpen: amount.contributionOpen,
    };
  });
}

export async function getPublicParticipatedPots(
  contributorInput: string,
): Promise<PublicParticipatedPot[]> {
  if (!isAddress(contributorInput)) {
    throw new PublicPotError("This wallet address is not valid.", 400);
  }

  const contributorAddress = getAddress(contributorInput);
  const contributor = contributorAddress.toLowerCase();
  const environment = getSupabaseEnvironment();
  const eventParameters = new URLSearchParams({
    select: "pot_address,block_number,event_data",
    chain_id: `eq.${baseSepolia.id}`,
    event_name: "eq.ContributionMade",
    "event_data->>contributor": `eq.${contributorAddress}`,
    order: "block_number.desc,log_index.desc",
    limit: String(MAX_CONTRIBUTION_EVENT_PAGE_SIZE),
  });
  const eventRows = await fetchSupabase(
    environment,
    `pot_events?${eventParameters.toString()}`,
    isContributionSearchRows,
  );

  const latestContributionBlockByPot = new Map<string, string>();
  for (const event of eventRows) {
    if (event.event_data.contributor.toLowerCase() !== contributor) continue;
    const potAddress = event.pot_address.toLowerCase();
    if (!latestContributionBlockByPot.has(potAddress)) {
      latestContributionBlockByPot.set(potAddress, event.block_number);
    }
  }
  const potAddresses = [...latestContributionBlockByPot.keys()].slice(0, MAX_PAGE_SIZE);
  if (potAddresses.length === 0) return [];

  const potParameters = new URLSearchParams({
    select: "address,name,target_based,created_block",
    chain_id: `eq.${baseSepolia.id}`,
    address: `in.(${potAddresses.join(",")})`,
    is_public: "eq.true",
  });
  const potRows = await fetchSupabase(
    environment,
    `pots?${potParameters.toString()}`,
    isOrganizerPotRows,
  );

  const addresses = potRows.map((pot) => getAddress(pot.address));
  const amounts = await getVerifiedPotAmounts(addresses, contributorAddress);
  const pots = potRows.flatMap((pot) => {
    const normalizedAddress = pot.address.toLowerCase();
    const lastContributionBlock = latestContributionBlockByPot.get(normalizedAddress);
    const amount = amounts.get(normalizedAddress);
    if (lastContributionBlock === undefined || !amount?.contributedAmount) return [];
    return [{
      address: getAddress(pot.address),
      name: pot.name,
      fundingMode: amount.fundingMode,
      targetBased: pot.target_based,
      createdBlock: pot.created_block,
      lastContributionBlock,
      contributedAmount: amount.contributedAmount,
      escrowBalance: amount.escrowBalance,
      totalContributed: amount.totalContributed,
      contributionOpen: amount.contributionOpen,
      paidOut: amount.paidOut,
    }];
  });
  return pots.sort((left, right) => {
    const leftBlock = BigInt(left.lastContributionBlock);
    const rightBlock = BigInt(right.lastContributionBlock);
    return leftBlock === rightBlock ? 0 : leftBlock > rightBlock ? -1 : 1;
  });
}

export function formatTokenAmount(amount: string, decimals: number): string {
  return formatUnits(BigInt(amount), decimals);
}

export function getPublicPotState(pot: PublicPotDetails): string {
  return getState(pot);
}
