import { getAddress, isAddress, parseAbi, parseEventLogs } from "viem";
import type { Address, Log } from "viem";
import { SETTLEMENT_TOKEN_DECIMALS } from "./pot-creation";

export const circleBaseSepoliaUsdc = getAddress(
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
);

export const potFactoryAbi = parseAbi([
  "function token() view returns (address)",
  "function isPot(address pot) view returns (bool)",
  "function createPot(string name, string metadataURI, bool targetBased, uint256 targetAmount, uint64 deadline, uint256 minimumContribution) returns (address potAddress)",
  "function createCrowdfundingPot(string name, string metadataURI, uint8 fundingMode, uint256 targetAmount, uint64 deadline, uint256 minimumContribution, address payoutRecipient) returns (address potAddress)",
  "function crowdfundingEnabled() view returns (bool)",
  "event PotCreated(address indexed pot, address indexed organizer, bool targetBased, uint256 targetAmount, uint64 deadline, uint256 minimumContribution, string name, string metadataURI)",
]);

export const potContractAbi = parseAbi([
  "function token() view returns (address)",
  "function fundingMode() view returns (uint8)",
  "function payoutRecipient() view returns (address)",
  "function targetBased() view returns (bool)",
  "function targetAmount() view returns (uint256)",
  "function minimumContribution() view returns (uint256)",
  "function totalContributed() view returns (uint256)",
  "function totalPaidOut() view returns (uint256)",
  "function isContributionOpen() view returns (bool)",
  "function isPayoutEligible() view returns (bool)",
  "function isRefundEligible() view returns (bool)",
  "function organizer() view returns (address)",
  "function paidOut() view returns (bool)",
  "function contributions(address contributor) view returns (uint256)",
  "function refundsClaimed(address contributor) view returns (bool)",
  "function contribute(uint256 amount)",
  "function payout()",
  "function claimRefund()",
]);

export const usdcAbi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
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
