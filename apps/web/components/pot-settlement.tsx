"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { getBuilderDataSuffix, requireBuilderDataSuffix } from "@/lib/builder-attribution";
import {
  circleBaseSepoliaUsdc,
  getConfiguredPotFactoryAddress,
  potContractAbi,
  potFactoryAbi,
} from "@/lib/pot-factory";
import { canClaimPotRefund, canOrganizerPayout } from "@/lib/pot-settlement";
import { supportedChain } from "@/lib/wagmi";
import type { PublicPotDetails } from "@/lib/public-pot";
import { formatUsdcBaseUnits } from "@/lib/pot-contribution";

type Props = {
  pot: PublicPotDetails;
  onConfirmed: () => void;
};

type SettlementAction = "payout" | "refund";
type SettlementPhase = "idle" | "submitting" | "confirming" | "confirmed" | "failed";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The wallet transaction could not be completed.";
}

export function PotSettlement({ pot, onConfirmed }: Props) {
  const [phase, setPhase] = useState<SettlementPhase>("idle");
  const [action, setAction] = useState<SettlementAction>();
  const [transactionHash, setTransactionHash] = useState<`0x${string}`>();
  const [transactionError, setTransactionError] = useState("");
  const { address: walletAddress, chainId, isConnected } = useAccount();
  const accountRef = useRef({ address: walletAddress, chainId });
  useEffect(() => {
    accountRef.current = { address: walletAddress, chainId };
  }, [walletAddress, chainId]);
  const { switchChain, isPending: isSwitchingChain, error: switchChainError } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: supportedChain.id });
  const factoryAddress = getConfiguredPotFactoryAddress();
  const hasBuilderCode = Boolean(getBuilderDataSuffix());
  const onSupportedNetwork = isConnected && chainId === supportedChain.id;
  const canRead = Boolean(factoryAddress && onSupportedNetwork);

  const registrationQuery = useReadContract({
    address: factoryAddress,
    abi: potFactoryAbi,
    functionName: "isPot",
    args: [pot.address],
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const factoryTokenQuery = useReadContract({
    address: factoryAddress,
    abi: potFactoryAbi,
    functionName: "token",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const potTokenQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "token",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const organizerQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "organizer",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const paidOutQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "paidOut",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const totalContributedQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "totalContributed",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const payoutEligibleQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "isPayoutEligible",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const refundEligibleQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "isRefundEligible",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const contributionQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "contributions",
    args: [walletAddress ?? circleBaseSepoliaUsdc],
    chainId: supportedChain.id,
    query: { enabled: canRead && Boolean(walletAddress) },
  });
  const refundClaimedQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "refundsClaimed",
    args: [walletAddress ?? circleBaseSepoliaUsdc],
    chainId: supportedChain.id,
    query: { enabled: canRead && Boolean(walletAddress) },
  });

  const queries = [
    registrationQuery,
    factoryTokenQuery,
    potTokenQuery,
    organizerQuery,
    paidOutQuery,
    totalContributedQuery,
    payoutEligibleQuery,
    refundEligibleQuery,
    contributionQuery,
    refundClaimedQuery,
  ];
  const hasReadError = queries.some((query) => query.isError);
  const isVerifying = canRead && queries.some((query) => query.isLoading);
  const chainDataReady =
    registrationQuery.data !== undefined &&
    factoryTokenQuery.data !== undefined &&
    potTokenQuery.data !== undefined &&
    organizerQuery.data !== undefined &&
    paidOutQuery.data !== undefined &&
    totalContributedQuery.data !== undefined &&
    payoutEligibleQuery.data !== undefined &&
    refundEligibleQuery.data !== undefined &&
    contributionQuery.data !== undefined &&
    refundClaimedQuery.data !== undefined;
  const tokenVerified =
    factoryTokenQuery.data?.toLowerCase() === circleBaseSepoliaUsdc.toLowerCase() &&
    potTokenQuery.data?.toLowerCase() === circleBaseSepoliaUsdc.toLowerCase();
  const walletSettlementState =
    walletAddress &&
    organizerQuery.data !== undefined &&
    paidOutQuery.data !== undefined &&
    payoutEligibleQuery.data !== undefined &&
    refundEligibleQuery.data !== undefined &&
    contributionQuery.data !== undefined &&
    refundClaimedQuery.data !== undefined
      ? {
          walletAddress,
          organizer: organizerQuery.data,
          paidOut: paidOutQuery.data,
          payoutEligible: payoutEligibleQuery.data,
          refundEligible: refundEligibleQuery.data,
          contribution: contributionQuery.data,
          refundClaimed: refundClaimedQuery.data,
        }
      : undefined;
  const payoutAllowed = walletSettlementState
    ? canOrganizerPayout(walletSettlementState)
    : false;
  const refundAllowed = walletSettlementState ? canClaimPotRefund(walletSettlementState) : false;
  const actionsReady = Boolean(
    factoryAddress &&
      isConnected &&
      walletAddress &&
      onSupportedNetwork &&
      hasBuilderCode &&
      chainDataReady &&
      registrationQuery.data === true &&
      tokenVerified &&
      !hasReadError,
  );
  const transactionPending = phase === "submitting" || phase === "confirming";

  async function refreshSettlementState() {
    await Promise.all(queries.map((query) => query.refetch()));
  }

  async function handleSettlement(nextAction: SettlementAction) {
    setAction(nextAction);
    setPhase("idle");
    setTransactionError("");
    setTransactionHash(undefined);

    if (!walletAddress || !publicClient || !factoryAddress || !isConnected) {
      setPhase("failed");
      setTransactionError("Connect a wallet and verify the configured Base Sepolia factory first.");
      return;
    }
    if (chainId !== supportedChain.id) {
      setPhase("failed");
      setTransactionError("Switch your wallet to Base Sepolia before settling this pot.");
      return;
    }

    try {
      requireBuilderDataSuffix();
      const [
        isRegistered,
        factoryToken,
        potToken,
        organizer,
        paidOut,
        payoutEligible,
        refundEligible,
        contribution,
        refundClaimed,
      ] = await Promise.all([
        publicClient.readContract({
          address: factoryAddress,
          abi: potFactoryAbi,
          functionName: "isPot",
          args: [pot.address],
        }),
        publicClient.readContract({
          address: factoryAddress,
          abi: potFactoryAbi,
          functionName: "token",
        }),
        publicClient.readContract({
          address: pot.address,
          abi: potContractAbi,
          functionName: "token",
        }),
        publicClient.readContract({
          address: pot.address,
          abi: potContractAbi,
          functionName: "organizer",
        }),
        publicClient.readContract({
          address: pot.address,
          abi: potContractAbi,
          functionName: "paidOut",
        }),
        publicClient.readContract({
          address: pot.address,
          abi: potContractAbi,
          functionName: "isPayoutEligible",
        }),
        publicClient.readContract({
          address: pot.address,
          abi: potContractAbi,
          functionName: "isRefundEligible",
        }),
        publicClient.readContract({
          address: pot.address,
          abi: potContractAbi,
          functionName: "contributions",
          args: [walletAddress],
        }),
        publicClient.readContract({
          address: pot.address,
          abi: potContractAbi,
          functionName: "refundsClaimed",
          args: [walletAddress],
        }),
      ]);

      if (!isRegistered) throw new Error("This pot is not registered by the configured factory.");
      if (
        factoryToken.toLowerCase() !== circleBaseSepoliaUsdc.toLowerCase() ||
        potToken.toLowerCase() !== circleBaseSepoliaUsdc.toLowerCase()
      ) {
        throw new Error("This pot does not use the verified Circle Base Sepolia USDC contract.");
      }

      const freshState = {
        walletAddress,
        organizer,
        paidOut,
        payoutEligible,
        refundEligible,
        contribution,
        refundClaimed,
      };
      if (nextAction === "payout" && !canOrganizerPayout(freshState)) {
        throw new Error("Payout is no longer eligible for this wallet.");
      }
      if (nextAction === "refund" && !canClaimPotRefund(freshState)) {
        throw new Error("This wallet has no unclaimed refund eligible under the pot rules.");
      }

      const connectedAccount = accountRef.current;
      if (
        connectedAccount.address?.toLowerCase() !== walletAddress.toLowerCase() ||
        connectedAccount.chainId !== supportedChain.id
      ) {
        throw new Error("Your connected wallet or network changed. Verify it and try again.");
      }

      setPhase("submitting");
      const hash =
        nextAction === "payout"
          ? await writeContractAsync({
              address: pot.address,
              abi: potContractAbi,
              functionName: "payout",
              account: walletAddress,
              chainId: supportedChain.id,
            })
          : await writeContractAsync({
              address: pot.address,
              abi: potContractAbi,
              functionName: "claimRefund",
              account: walletAddress,
              chainId: supportedChain.id,
            });
      setTransactionHash(hash);
      setPhase("confirming");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error(
          nextAction === "payout"
            ? "The payout transaction reverted. Funds were not paid out."
            : "The refund transaction reverted. No funds were returned.",
        );
      }

      setPhase("confirmed");
      onConfirmed();
      try {
        await refreshSettlementState();
      } catch (error) {
        console.error("Settlement confirmed but state could not be refreshed", error);
        setTransactionError(
          "Transaction confirmed, but the latest pot state could not be refreshed. Reload the page to verify it.",
        );
      }
    } catch (error) {
      setPhase("failed");
      setTransactionError(getErrorMessage(error));
    }
  }

  const stateMessage = !factoryAddress
    ? "Settlement actions are disabled until the deployed Base Sepolia factory is configured."
    : !isConnected
      ? "Connect your wallet to check organizer payout or personal refund eligibility."
      : !onSupportedNetwork
        ? "Switch your wallet to Base Sepolia to check settlement eligibility."
        : !hasBuilderCode
          ? "Settlement transactions are disabled until a Base Builder Code is configured."
          : hasReadError
            ? "Could not verify this pot’s settlement state on Base Sepolia. Refresh and try again."
            : isVerifying || !chainDataReady
              ? "Checking current settlement eligibility on Base Sepolia…"
              : registrationQuery.data !== true
                ? "This address is not a pot registered by the configured factory."
                : !tokenVerified
                  ? "Settlement is disabled because this pot does not use Circle Base Sepolia USDC."
                  : paidOutQuery.data
                    ? "This pot has already paid out. No further payout or refund can be claimed."
                    : refundEligibleQuery.data
                      ? refundAllowed
                        ? "This wallet’s contribution is eligible for a one-time refund."
                        : contributionQuery.data === BigInt(0)
                          ? "Refunds are available, but this wallet has no contribution in this pot."
                          : refundClaimedQuery.data
                            ? "This wallet has already claimed its refund."
                            : "This wallet is not eligible to claim a refund."
                      : payoutEligibleQuery.data
                        ? payoutAllowed
                          ? "The organizer can withdraw the pot’s confirmed USDC."
                          : "The funding goal is reached and payout is available to the organizer."
                        : pot.targetBased
                          ? "Payout becomes available to the organizer when the funding goal is reached."
                          : "The organizer can withdraw after the first confirmed contribution.";

  return (
    <section className="pot-settlement" aria-labelledby="pot-settlement-title">
      <div className="pot-settlement-heading">
        <div>
          <p className="pot-eyebrow">ONCHAIN SETTLEMENT</p>
          <h2 id="pot-settlement-title">Payouts and refunds</h2>
        </div>
        <span className="pot-settlement-token">USDC · Base Sepolia</span>
      </div>

      {!isConnected && (
        <Link className="pot-settlement-connect" href="/connect">
          Connect wallet to check eligibility
        </Link>
      )}
      {isConnected && !onSupportedNetwork && (
        <button
          className="pot-contribution-network-button"
          disabled={isSwitchingChain}
          onClick={() => switchChain({ chainId: supportedChain.id })}
          type="button"
        >
          {isSwitchingChain ? "Switching network…" : `Switch to ${supportedChain.name}`}
        </button>
      )}
      {switchChainError && <p className="pot-settlement-error" role="alert">{switchChainError.message}</p>}

      <p className="pot-settlement-message" role="status" aria-live="polite">
        {stateMessage}
      </p>

      {walletAddress && actionsReady && payoutAllowed && (
        <div className="pot-settlement-action">
          <p>
            Confirmed pot balance:{" "}
            <strong>
              {formatUsdcBaseUnits(totalContributedQuery.data ?? BigInt(0))} USDC
            </strong>
          </p>
          <button
            className="pot-settlement-button"
            disabled={transactionPending}
            onClick={() => void handleSettlement("payout")}
            type="button"
          >
            {transactionPending && action === "payout"
              ? phase === "submitting"
                ? "Confirm payout in your wallet…"
                : "Waiting for payout confirmation…"
              : "Withdraw pot funds"}
          </button>
        </div>
      )}

      {walletAddress && actionsReady && refundAllowed && (
        <div className="pot-settlement-action">
          <p>
            Your refundable contribution:{" "}
            <strong>{formatUsdcBaseUnits(contributionQuery.data ?? BigInt(0))} USDC</strong>
          </p>
          <button
            className="pot-settlement-button pot-settlement-refund-button"
            disabled={transactionPending}
            onClick={() => void handleSettlement("refund")}
            type="button"
          >
            {transactionPending && action === "refund"
              ? phase === "submitting"
                ? "Confirm refund in your wallet…"
                : "Waiting for refund confirmation…"
              : "Claim my refund"}
          </button>
        </div>
      )}

      {transactionError && <p className="pot-settlement-error" role="alert">{transactionError}</p>}
      {phase === "confirmed" && (
        <p className="pot-settlement-confirmed" role="status" aria-live="polite">
          {action === "payout"
            ? "Payout confirmed on Base Sepolia."
            : "Refund confirmed on Base Sepolia."}
        </p>
      )}
      {transactionHash && (
        <a
          className="pot-contribution-transaction-link"
          href={`${supportedChain.blockExplorers.default.url}/tx/${transactionHash}`}
          rel="noreferrer"
          target="_blank"
        >
          View {action === "payout" ? "payout" : "refund"} transaction on BaseScan
        </a>
      )}
    </section>
  );
}
