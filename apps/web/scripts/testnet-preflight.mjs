import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
} from "viem";
import { baseSepolia } from "viem/chains";

const officialUsdcAddress = getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
const usdcAbi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

let configuredRpcUrl;

function requiredWallet(name, label) {
  if (!name || !isAddress(name)) {
    throw new Error(`${label} must be a public EVM address in apps/web/.env.local.`);
  }
  const address = getAddress(name);
  if (BigInt(address) <= BigInt("0xffff")) {
    throw new Error(`${label} cannot be a reserved low EVM address.`);
  }
  return address;
}

async function main() {
  const organizer = requiredWallet(
    process.env.POT_TEST_ORGANIZER_ADDRESS?.trim(),
    "POT_TEST_ORGANIZER_ADDRESS",
  );
  const contributor = requiredWallet(
    process.env.POT_TEST_CONTRIBUTOR_ADDRESS?.trim(),
    "POT_TEST_CONTRIBUTOR_ADDRESS",
  );

  if (organizer.toLowerCase() === contributor.toLowerCase()) {
    throw new Error("Organizer and contributor test wallets must be different addresses.");
  }

  const rpcUrl =
    process.env.BASE_SEPOLIA_RPC_URL?.trim() || baseSepolia.rpcUrls.default.http[0];
  if (!rpcUrl) {
    throw new Error("No Base Sepolia RPC URL is available.");
  }
  configuredRpcUrl = rpcUrl;

  let parsedRpcUrl;
  try {
    parsedRpcUrl = new URL(rpcUrl);
  } catch {
    throw new Error("BASE_SEPOLIA_RPC_URL must be a valid HTTPS URL.");
  }
  if (
    parsedRpcUrl.protocol !== "https:" ||
    parsedRpcUrl.username ||
    parsedRpcUrl.password
  ) {
    throw new Error("BASE_SEPOLIA_RPC_URL must be an HTTPS URL.");
  }

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl, { timeout: 15_000 }),
  });
  const chainId = await client.getChainId();
  if (chainId !== baseSepolia.id) {
    throw new Error(`RPC returned chain ID ${chainId}; expected ${baseSepolia.id}.`);
  }

  const code = await client.getBytecode({ address: officialUsdcAddress });
  if (!code) throw new Error("Circle's verified Base Sepolia USDC contract has no bytecode.");

  const [symbol, decimals, organizerBalance, contributorBalance] = await Promise.all([
    client.readContract({
      address: officialUsdcAddress,
      abi: usdcAbi,
      functionName: "symbol",
    }),
    client.readContract({
      address: officialUsdcAddress,
      abi: usdcAbi,
      functionName: "decimals",
    }),
    Promise.all([
      client.getBalance({ address: organizer }),
      client.readContract({
        address: officialUsdcAddress,
        abi: usdcAbi,
        functionName: "balanceOf",
        args: [organizer],
      }),
    ]),
    Promise.all([
      client.getBalance({ address: contributor }),
      client.readContract({
        address: officialUsdcAddress,
        abi: usdcAbi,
        functionName: "balanceOf",
        args: [contributor],
      }),
    ]),
  ]);

  if (symbol !== "USDC" || decimals !== 6) {
    throw new Error(`Unexpected token metadata: ${symbol}, ${decimals} decimals.`);
  }

  const wallets = [
    { role: "organizer", address: organizer, balances: organizerBalance },
    { role: "contributor", address: contributor, balances: contributorBalance },
  ].map(({ role, address, balances }) => ({
    role,
    address,
    eth: formatUnits(balances[0], 18),
    usdc: formatUnits(balances[1], decimals),
    hasTestBalances: balances[0] > BigInt(0) && balances[1] > BigInt(0),
  }));

  console.log(
    JSON.stringify(
      {
        chainId,
        network: baseSepolia.name,
        usdc: {
          address: officialUsdcAddress,
          symbol,
          decimals,
          explorerUrl: `${baseSepolia.blockExplorers.default.url}/address/${officialUsdcAddress}`,
        },
        wallets,
      },
      null,
      2,
    ),
  );

  if (wallets.some((wallet) => !wallet.hasTestBalances)) {
    throw new Error(
      "Fund both test wallets with Base Sepolia ETH for gas and Circle USDC before transaction tests.",
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = configuredRpcUrl
    ? message.replaceAll(configuredRpcUrl, "[configured RPC endpoint]")
    : message;
  console.error("Base Sepolia wallet preflight failed:", safeMessage);
  process.exitCode = 1;
});
