import { getAddress, isAddress, parseAbi, parseEventLogs } from "viem";
import type { Address, Log } from "viem";
import { SETTLEMENT_TOKEN_DECIMALS } from "./pot-creation";

export const circleBaseSepoliaUsdc = getAddress(
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
);

export const potFactoryAbi = parseAbi([
  "function token() view returns (address)",
  "function createPot(string name, string metadataURI, bool targetBased, uint256 targetAmount, uint64 deadline, uint256 minimumContribution) returns (address potAddress)",
  "event PotCreated(address indexed pot, address indexed organizer, bool targetBased, uint256 targetAmount, uint64 deadline, uint256 minimumContribution, string name, string metadataURI)",
]);

export const circleUsdcDecimals = SETTLEMENT_TOKEN_DECIMALS;

export function getConfiguredPotFactoryAddress(
  configuredAddress = process.env.NEXT_PUBLIC_POT_FACTORY_ADDRESS,
): Address | undefined {
  const address = configuredAddress?.trim();
  return address && isAddress(address) ? getAddress(address) : undefined;
}

export function getCreatedPotAddress(logs: readonly Log[]): Address | undefined {
  const events = parseEventLogs({
    abi: potFactoryAbi,
    eventName: "PotCreated",
    logs: [...logs],
    strict: false,
  });
  return events[0]?.args.pot;
}
