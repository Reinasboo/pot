import { existsSync } from "node:fs";
import { isAddress, zeroAddress } from "viem";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const issues = [];
const required = [
  "BASE_SEPOLIA_RPC_URL",
  "POT_FACTORY_ADDRESS",
  "POT_INDEXER_START_BLOCK",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "INDEXER_CRON_SECRET",
  "NEXT_PUBLIC_POT_FACTORY_ADDRESS",
  "NEXT_PUBLIC_BASE_BUILDER_CODE",
];
const value = (key) => process.env[key]?.trim() ?? "";
for (const key of required) if (!value(key)) issues.push(`${key}: missing`);
for (const key of [
  "BASE_SEPOLIA_RPC_URL",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
]) {
  if (!value(key)) continue;
  try {
    const url = new URL(value(key));
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error();
  } catch {
    issues.push(`${key}: must be an HTTPS URL without embedded credentials`);
  }
}
for (const key of ["POT_FACTORY_ADDRESS", "NEXT_PUBLIC_POT_FACTORY_ADDRESS"]) {
  if (
    value(key) &&
    (!isAddress(value(key)) || value(key).toLowerCase() === zeroAddress)
  )
    issues.push(`${key}: invalid contract address`);
}
if (
  value("POT_FACTORY_ADDRESS") &&
  value("NEXT_PUBLIC_POT_FACTORY_ADDRESS") &&
  value("POT_FACTORY_ADDRESS").toLowerCase() !==
    value("NEXT_PUBLIC_POT_FACTORY_ADDRESS").toLowerCase()
)
  issues.push("Server and public factory addresses must match");
if (
  value("POT_INDEXER_START_BLOCK") &&
  !/^\d+$/.test(value("POT_INDEXER_START_BLOCK"))
)
  issues.push(
    "POT_INDEXER_START_BLOCK: must be the non-negative deployment block number",
  );
if (
  new TextEncoder().encode(value("NEXT_PUBLIC_BASE_BUILDER_CODE")).length > 255
)
  issues.push("NEXT_PUBLIC_BASE_BUILDER_CODE: exceeds 255 bytes");
for (const key of ["POT_INDEXER_CONFIRMATIONS", "POT_INDEXER_BATCH_SIZE"]) {
  if (value(key) && (!/^\d+$/.test(value(key)) || BigInt(value(key)) === 0n))
    issues.push(`${key}: must be a positive integer`);
}
if (issues.length) {
  console.log("Planner ready. Testnet integration needs configuration:\n");
  for (const issue of issues) console.log(`- ${issue}`);
  console.log(
    "\nSee .env.example and ../../docs/LOCAL_BUILD.md. No secret values were printed.",
  );
  if (process.argv.includes("--strict")) process.exitCode = 1;
} else {
  console.log(
    "All required settings are present and structurally valid. Run check:testnet and the two-wallet verification before enabling payments. This check does not contact external services.",
  );
}
