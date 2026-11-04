import { timingSafeEqual } from "node:crypto";
import { createPublicClient, getAddress, http, isAddress, parseAbiItem } from "viem";
import { baseSepolia } from "viem/chains";

const potCreatedEvent = parseAbiItem(
  "event PotCreated(address indexed pot, address indexed organizer, bool targetBased, uint256 targetAmount, uint64 deadline, uint256 minimumContribution, string name, string metadataURI)",
);
const contributionEvent = parseAbiItem(
  "event ContributionMade(address indexed contributor, uint256 amount, uint256 totalContributed)",
);
const payoutEvent = parseAbiItem("event PotPaidOut(address indexed organizer, uint256 amount)");
const refundEvent = parseAbiItem(
  "event ContributionRefunded(address indexed contributor, uint256 amount)",
);

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type IndexerEnvironment = {
  supabaseUrl: string;
  serviceRoleKey: string;
  rpcUrl: string;
  factoryAddress: `0x${string}`;
  cronSecret: string;
  initialBlock: number;
  confirmations: bigint;
  batchSize: number;
};

type Batch = {
  from_block: string | null;
  to_block: string | null;
};

type PotRow = {
  address: string;
};

type IndexState = {
  next_block: string;
  last_block_hash: `0x${string}` | null;
};

type EventRow = {
  chain_id: number;
  transaction_hash: `0x${string}`;
  log_index: number;
  pot_address: string;
  block_number: string;
  block_hash: `0x${string}`;
  event_name: string;
  event_data: Record<string, JsonValue>;
};

class IndexerError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "IndexerError";
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new IndexerError(`Missing required server environment variable: ${name}`, 503);
  return value;
}

function positiveIntegerEnvironment(name: string, defaultValue: number): number {
  const value = process.env[name]?.trim();
  if (!value) return defaultValue;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new IndexerError(`${name} must be a positive safe integer`, 503);
  }
  return parsed;
}

function requiredPositiveIntegerEnvironment(name: string): number {
  const value = requiredEnvironment(name);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new IndexerError(`${name} must be a positive safe integer`, 503);
  }
  return parsed;
}

function readEnvironment(): IndexerEnvironment {
  const rpcUrl = requiredEnvironment("BASE_SEPOLIA_RPC_URL");
  let parsedRpcUrl: URL;
  try {
    parsedRpcUrl = new URL(rpcUrl);
  } catch {
    throw new IndexerError("BASE_SEPOLIA_RPC_URL must be an HTTPS URL", 503);
  }
  if (parsedRpcUrl.protocol !== "https:") {
    throw new IndexerError("BASE_SEPOLIA_RPC_URL must use HTTPS", 503);
  }

  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  let parsedSupabaseUrl: URL;
  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw new IndexerError("SUPABASE_URL must be an HTTPS URL", 503);
  }
  if (
    parsedSupabaseUrl.protocol !== "https:" ||
    parsedSupabaseUrl.username ||
    parsedSupabaseUrl.password
  ) {
    throw new IndexerError("SUPABASE_URL must be HTTPS and must not contain credentials", 503);
  }

  const factoryAddress = requiredEnvironment("POT_FACTORY_ADDRESS");
  if (!isAddress(factoryAddress)) {
    throw new IndexerError("POT_FACTORY_ADDRESS must be a valid EVM address", 503);
  }
  const cronSecret = requiredEnvironment("INDEXER_CRON_SECRET");
  if (cronSecret.length < 32) {
    throw new IndexerError("INDEXER_CRON_SECRET must be at least 32 characters", 503);
  }
  const batchSize = positiveIntegerEnvironment("POT_INDEXER_BATCH_SIZE", 500);
  if (batchSize > 2000) {
    throw new IndexerError("POT_INDEXER_BATCH_SIZE cannot exceed 2000", 503);
  }

  return {
    supabaseUrl: parsedSupabaseUrl.toString().replace(/\/+$/, ""),
    serviceRoleKey: requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    rpcUrl,
    factoryAddress: getAddress(factoryAddress),
    cronSecret,
    initialBlock: requiredPositiveIntegerEnvironment("POT_INDEXER_START_BLOCK"),
    confirmations: BigInt(positiveIntegerEnvironment("POT_INDEXER_CONFIRMATIONS", 64)),
    batchSize,
  };
}

function hasValidAuthorization(request: Request, secret: string): boolean {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function toJsonValue(value: unknown): JsonValue {
  if (typeof value === "bigint") return value.toString();
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(toJsonValue);

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)]),
    );
  }

  throw new IndexerError("Encountered a non-JSON value while serializing a contract event");
}

function serializeEventData(args: object): Record<string, JsonValue> {
  const value = toJsonValue(args);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new IndexerError("Contract event arguments must be a JSON object");
  }
  return value;
}

async function supabaseRequest<T>(
  environment: IndexerEnvironment,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${environment.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: environment.serviceRoleKey,
      authorization: `Bearer ${environment.serviceRoleKey}`,
      "content-type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new IndexerError(
      `Supabase request failed (${response.status}): ${responseText.slice(0, 500)}`,
      502,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function rpc<T>(
  environment: IndexerEnvironment,
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  return supabaseRequest<T>(environment, `rpc/${functionName}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function getIndexerState(
  environment: IndexerEnvironment,
): Promise<IndexState | null> {
  const parameters = new URLSearchParams({
    select: "next_block,last_block_hash",
    chain_id: `eq.${baseSepolia.id}`,
    limit: "1",
  });
  const rows = await supabaseRequest<IndexState[]>(
    environment,
    `indexer_state?${parameters.toString()}`,
  );
  return rows[0] ?? null;
}

async function rewindIfNeeded(
  environment: IndexerEnvironment,
): Promise<void> {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(environment.rpcUrl),
  });
  const state = await getIndexerState(environment);
  if (!state?.last_block_hash) return;

  const nextBlock = BigInt(state.next_block);
  if (nextBlock <= BigInt(environment.initialBlock)) return;

  const lastIndexedBlock = nextBlock - BigInt(1);
  const canonicalBlock = await client.getBlock({ blockNumber: lastIndexedBlock });
  if (!canonicalBlock.hash || canonicalBlock.hash.toLowerCase() === state.last_block_hash) return;

  const rewindBlock = BigInt(environment.initialBlock);
  const rewindParent = await client.getBlock({ blockNumber: rewindBlock - BigInt(1) });
  if (!rewindParent.hash) {
    throw new IndexerError("Could not verify the canonical block preceding the indexer range", 502);
  }

  await rpc(environment, "rewind_indexer_cursor", {
    p_chain_id: baseSepolia.id,
    p_initial_block: environment.initialBlock,
    p_next_block: environment.initialBlock,
    p_last_block_hash: rewindParent.hash,
  });
}

function makeEventRow(
  log: {
    address: `0x${string}`;
    transactionHash: `0x${string}` | null;
    logIndex: number | null;
    blockNumber: bigint | null;
    blockHash: `0x${string}` | null;
    args: object;
  },
  eventName: string,
  potAddress = log.address,
): EventRow {
  if (!log.transactionHash || log.logIndex === null || log.blockNumber === null || !log.blockHash) {
    throw new IndexerError(`Incomplete RPC log returned for ${eventName}`);
  }

  return {
    chain_id: baseSepolia.id,
    transaction_hash: log.transactionHash.toLowerCase() as `0x${string}`,
    log_index: log.logIndex,
    pot_address: potAddress.toLowerCase(),
    block_number: log.blockNumber.toString(),
    block_hash: log.blockHash.toLowerCase() as `0x${string}`,
    event_name: eventName,
    event_data: serializeEventData(log.args),
  };
}

async function upsertRows(
  environment: IndexerEnvironment,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  resolution: "ignore-duplicates" | "merge-duplicates",
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500);
    await supabaseRequest<void>(
      environment,
      `${table}?on_conflict=${encodeURIComponent(onConflict)}`,
      {
        method: "POST",
        headers: { prefer: `resolution=${resolution},return=minimal` },
        body: JSON.stringify(batch),
      },
    );
  }
}

async function getAllPotAddresses(environment: IndexerEnvironment): Promise<`0x${string}`[]> {
  const addresses: `0x${string}`[] = [];

  for (let offset = 0; ; offset += 1000) {
    const parameters = new URLSearchParams({
      select: "address",
      chain_id: `eq.${baseSepolia.id}`,
      order: "address.asc",
      limit: "1000",
      offset: String(offset),
    });
    const rows = await supabaseRequest<PotRow[]>(
      environment,
      `pots?${parameters.toString()}`,
    );

    for (const row of rows) {
      if (!isAddress(row.address)) {
        throw new IndexerError("Supabase contains an invalid indexed pot address");
      }
      addresses.push(getAddress(row.address));
    }

    if (rows.length < 1000) return addresses;
  }
}

async function indexBatch(
  environment: IndexerEnvironment,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<number> {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(environment.rpcUrl),
  });
  const factoryLogs = await client.getLogs({
    address: environment.factoryAddress,
    event: potCreatedEvent,
    fromBlock,
    toBlock,
  });

  const createdPotRows = factoryLogs.map((log) => {
    const args = log.args;
    if (
      !args.pot ||
      !args.organizer ||
      args.targetBased === undefined ||
      args.targetAmount === undefined ||
      args.deadline === undefined ||
      args.minimumContribution === undefined ||
      args.name === undefined ||
      args.metadataURI === undefined ||
      !log.transactionHash ||
      log.logIndex === null ||
      log.blockNumber === null
    ) {
      throw new IndexerError("Factory emitted an incomplete PotCreated event");
    }

    return {
      chain_id: baseSepolia.id,
      address: args.pot.toLowerCase(),
      organizer: args.organizer.toLowerCase(),
      target_based: args.targetBased,
      target_amount: args.targetAmount.toString(),
      deadline: args.deadline.toString(),
      minimum_contribution: args.minimumContribution.toString(),
      name: args.name,
      metadata_uri: args.metadataURI,
      created_block: log.blockNumber.toString(),
      created_transaction_hash: log.transactionHash.toLowerCase(),
      created_log_index: log.logIndex,
    };
  });

  if (createdPotRows.length > 0) {
    await upsertRows(
      environment,
      "pots",
      createdPotRows,
      "chain_id,address",
      "ignore-duplicates",
    );
  }

  const potAddresses = await getAllPotAddresses(environment);
  const indexedEvents: EventRow[] = factoryLogs.map((log) => {
    if (!log.args.pot) throw new IndexerError("Factory emitted a PotCreated event without a pot");
    return makeEventRow(log, "PotCreated", log.args.pot);
  });

  for (let offset = 0; offset < potAddresses.length; offset += 100) {
    const addressBatch = potAddresses.slice(offset, offset + 100);
    const [contributions, payouts, refunds] = await Promise.all([
      client.getLogs({ address: addressBatch, event: contributionEvent, fromBlock, toBlock }),
      client.getLogs({ address: addressBatch, event: payoutEvent, fromBlock, toBlock }),
      client.getLogs({ address: addressBatch, event: refundEvent, fromBlock, toBlock }),
    ]);

    indexedEvents.push(
      ...contributions.map((log) => makeEventRow(log, "ContributionMade")),
      ...payouts.map((log) => makeEventRow(log, "PotPaidOut")),
      ...refunds.map((log) => makeEventRow(log, "ContributionRefunded")),
    );
  }

  await upsertRows(
    environment,
    "pot_events",
    indexedEvents,
    "chain_id,transaction_hash,log_index",
    "merge-duplicates",
  );

  return indexedEvents.length;
}

export async function POST(request: Request): Promise<Response> {
  let leaseId: string | null = null;
  let environment: IndexerEnvironment | null = null;

  try {
    const cronSecret = requiredEnvironment("INDEXER_CRON_SECRET");
    if (cronSecret.length < 32) {
      throw new IndexerError("INDEXER_CRON_SECRET must be at least 32 characters", 503);
    }
    if (!hasValidAuthorization(request, cronSecret)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    environment = readEnvironment();
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(environment.rpcUrl),
    });
    const chainId = await client.getChainId();
    if (chainId !== baseSepolia.id) {
      throw new IndexerError(`Configured RPC returned chain ID ${chainId}, expected 84532`, 503);
    }

    await rewindIfNeeded(environment);

    const latestBlock = await client.getBlockNumber();
    if (latestBlock <= environment.confirmations) {
      return Response.json({
        status: "waiting_for_confirmations",
        indexedEvents: 0,
      });
    }

    const safeHead = latestBlock - environment.confirmations;
    leaseId = crypto.randomUUID();
    const batches = await rpc<Batch[]>(environment, "claim_indexer_batch", {
      p_chain_id: baseSepolia.id,
      p_initial_block: environment.initialBlock,
      p_end_block: safeHead.toString(),
      p_batch_size: environment.batchSize,
      p_lease_id: leaseId,
    });
    const batch = batches[0];

    if (!batch || batch.from_block === null || batch.to_block === null) {
      return Response.json({
        status: "up_to_date",
        safeHead: safeHead.toString(),
        indexedEvents: 0,
      });
    }

    const fromBlock = BigInt(batch.from_block);
    const toBlock = BigInt(batch.to_block);
    const indexedEvents = await indexBatch(environment, fromBlock, toBlock);
    const endBlock = await client.getBlock({ blockNumber: toBlock });
    if (!endBlock.hash) throw new IndexerError("Could not verify the indexed batch's final block");

    await rpc(environment, "complete_indexer_batch", {
      p_chain_id: baseSepolia.id,
      p_lease_id: leaseId,
      p_to_block: toBlock.toString(),
      p_block_hash: endBlock.hash,
    });
    leaseId = null;

    return Response.json({
      status: "indexed",
      fromBlock: fromBlock.toString(),
      toBlock: toBlock.toString(),
      indexedEvents,
    });
  } catch (error) {
    if (leaseId && environment) {
      try {
        await rpc(environment, "release_indexer_batch", {
          p_chain_id: baseSepolia.id,
          p_lease_id: leaseId,
        });
      } catch (releaseError) {
        console.error("Could not release the failed indexer batch lease", releaseError);
      }
    }

    if (error instanceof IndexerError) {
      if (error.status >= 500) console.error("Pot event indexer failed", error.message);
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("Pot event indexer failed unexpectedly", error);
    return Response.json({ error: "The event indexer encountered an unexpected error" }, { status: 500 });
  }
}
