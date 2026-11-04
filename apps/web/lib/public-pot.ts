import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
} from "viem";
import { baseSepolia } from "viem/chains";

const potFactoryAbi = parseAbi([
  "function isPot(address pot) view returns (bool)",
]);

const potAbi = parseAbi([
  "function token() view returns (address)",
  "function organizer() view returns (address)",
  "function targetBased() view returns (bool)",
  "function targetAmount() view returns (uint256)",
  "function deadline() view returns (uint64)",
  "function minimumContribution() view returns (uint256)",
  "function name() view returns (string)",
  "function metadataURI() view returns (string)",
  "function totalContributed() view returns (uint256)",
  "function totalRefunded() view returns (uint256)",
  "function paidOut() view returns (bool)",
  "function isContributionOpen() view returns (bool)",
  "function isPayoutEligible() view returns (bool)",
  "function isRefundEligible() view returns (bool)",
]);

const tokenAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

const MAX_PAGE_SIZE = 25;
const MAX_CONTRIBUTION_EVENT_PAGE_SIZE = 250;

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
  targetBased: boolean;
  createdBlock: string;
};

export type PublicParticipatedPot = PublicOrganizerPot & {
  lastContributionBlock: string;
};

export type PublicPotDetails = {
  address: `0x${string}`;
  chainId: number;
  organizer: `0x${string}`;
  token: `0x${string}`;
  name: string;
  metadataURI: string;
  description: string;
  coverImageUrl: string | null;
  targetBased: boolean;
  targetAmount: string;
  deadline: string;
  minimumContribution: string;
  totalContributed: string;
  totalRefunded: string;
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
        (typeof row.cover_image_url === "string" || row.cover_image_url === null),
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

  if (!response.ok) {
    console.error("Public pot metadata query failed", response.status, await response.text());
    throw new PublicPotError("Could not load this pot’s public activity.", 502);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    console.error("Public pot metadata query returned invalid JSON", error);
    throw new PublicPotError("Could not load this pot’s public activity.", 502);
  }
  if (!isExpected(data)) {
    console.error("Public pot metadata query returned an invalid response shape");
    throw new PublicPotError("Could not load this pot’s public activity.", 502);
  }
  return data;
}

function getState(pot: PublicPotDetails) {
  const total = BigInt(pot.totalContributed);
  if (pot.paidOut) return "Paid out";
  if (pot.refundEligible) return "Refunds available";
  if (pot.targetBased && total >= BigInt(pot.targetAmount)) return "Goal reached";
  if (pot.targetBased && !pot.contributionOpen) return "Funding closed";
  if (pot.targetBased && total === BigInt(0)) return "Awaiting first contribution";
  if (pot.targetBased) return "Funding in progress";
  return "Open pot";
}

export async function getPublicPot(addressInput: string): Promise<PublicPotDetails> {
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
    targetBased,
    targetAmount,
    deadline,
    minimumContribution,
    name,
    metadataURI,
    totalContributed,
    totalRefunded,
    paidOut,
    contributionOpen,
    payoutEligible,
    refundEligible,
  ] = await Promise.all([
    client.readContract({ address, abi: potAbi, functionName: "token", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "organizer", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "targetBased", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "targetAmount", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "deadline", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "minimumContribution", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "name", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "metadataURI", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "totalContributed", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "totalRefunded", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "paidOut", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "isContributionOpen", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "isPayoutEligible", blockNumber }),
    client.readContract({ address, abi: potAbi, functionName: "isRefundEligible", blockNumber }),
  ]).catch((error: unknown) => {
    console.error("Could not load public pot contract state", error);
    throw new PublicPotError("Could not load this pot’s current contract state.", 502);
  });

  const [tokenDecimals, tokenSymbol] = await Promise.all([
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
  ]).catch((error: unknown) => {
    console.error("Could not read the configured token metadata", error);
    throw new PublicPotError("Could not read this pot’s token configuration.", 502);
  });
  if (tokenDecimals > 36) {
    throw new PublicPotError("This pot uses an unsupported token decimal configuration.", 502);
  }

  const metadataParameters = new URLSearchParams({
    select: "description,cover_image_url",
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

  const [metadataRows, eventRows] = await Promise.all([
    fetchSupabase(
      environment,
      `pots?${metadataParameters.toString()}`,
      isMetadataRows,
    ),
    fetchSupabase(
      environment,
      `pot_events?${eventParameters.toString()}`,
      isEventRows,
    ),
  ]);
  const metadata = metadataRows[0];
  const explorerUrl = baseSepolia.blockExplorers.default.url;

  return {
    address,
    chainId,
    organizer,
    token,
    name,
    metadataURI,
    description: metadata?.description ?? "",
    coverImageUrl: metadata?.cover_image_url ?? null,
    targetBased,
    targetAmount: targetAmount.toString(),
    deadline: deadline.toString(),
    minimumContribution: minimumContribution.toString(),
    totalContributed: totalContributed.toString(),
    totalRefunded: totalRefunded.toString(),
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

  return rows.map((row) => ({
    address: getAddress(row.address),
    name: row.name,
    targetBased: row.target_based,
    createdBlock: row.created_block,
  }));
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

  const pots = potRows.flatMap((pot) => {
    const lastContributionBlock = latestContributionBlockByPot.get(pot.address.toLowerCase());
    if (lastContributionBlock === undefined) return [];
    return [{
      address: getAddress(pot.address),
      name: pot.name,
      targetBased: pot.target_based,
      createdBlock: pot.created_block,
      lastContributionBlock,
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
