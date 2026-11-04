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
import { canAuthorizedPayout, canClaimPotRefund } from "@/lib/pot-settlement";
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
  const payoutRecipientQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "payoutRecipient",
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
    payoutRecipientQuery,
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
    payoutRecipientQuery.data !== undefined &&
    paidOutQuery.data !== undefined &&
    totalContributedQuery.data !== undefined &&
    payoutEligibleQuery.data !== undefined &&
    refundEligibleQuery.data !== undefined &&
    contributionQuery.data !== undefined &&
    refundClaimedQuery.data !== undefined;
  const tokenVerified =
    factoryTokenQuery.data?.toLowerCase() === circleBaseSepoliaUsdc.toLowerCase() &&
    potTokenQuery.data?.toLowerCase() === circleBaseSepoliaUsdc.toLowerCase();
  const potDetailsMatch =
    organizerQuery.data?.toLowerCase() === pot.organizer.toLowerCase() &&
    payoutRecipientQuery.data?.toLowerCase() === pot.payoutRecipient.toLowerCase();
  const availableToWithdraw = BigInt(pot.currentBalance);
  const walletSettlementState =
    walletAddress &&
    organizerQuery.data !== undefined &&
    payoutRecipientQuery.data !== undefined &&
    paidOutQuery.data !== undefined &&
    payoutEligibleQuery.data !== undefined &&
    refundEligibleQuery.data !== undefined &&
    contributionQuery.data !== undefined &&
    refundClaimedQuery.data !== undefined
      ? {
          walletAddress,
          payoutRecipient: payoutRecipientQuery.data,
          paidOut: paidOutQuery.data,
          payoutEligible: payoutEligibleQuery.data,
          refundEligible: refundEligibleQuery.data,
          contribution: contributionQuery.data,
          refundClaimed: refundClaimedQuery.data,
        }
      : undefined;
  const payoutAllowed = walletSettlementState
    ? canAuthorizedPayout(walletSettlementState)
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
      potDetailsMatch &&
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
        payoutRecipient,
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
          functionName: "payoutRecipient",
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
      if (organizer.toLowerCase() !== pot.organizer.toLowerCase()) {
        throw new Error("The displayed organizer does not match the pot contract.");
      }
      if (payoutRecipient.toLowerCase() !== pot.payoutRecipient.toLowerCase()) {
        throw new Error("The displayed payout wallet does not match the pot contract.");
      }
      if (
        factoryToken.toLowerCase() !== circleBaseSepoliaUsdc.toLowerCase() ||
        potToken.toLowerCase() !== circleBaseSepoliaUsdc.toLowerCase()
      ) {
        throw new Error("This pot does not use the verified Circle Base Sepolia USDC contract.");
      }

      const freshState = {
        walletAddress,
        payoutRecipient,
        paidOut,
        payoutEligible,
        refundEligible,
        contribution,
        refundClaimed,
      };
      if (nextAction === "payout" && !canAuthorizedPayout(freshState)) {
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
    ? "You cannot withdraw or claim a refund yet. POT has not deployed the contract that holds pot money."
    : !isConnected
      ? "Connect your wallet to see whether you can withdraw or claim your contribution back."
      : !onSupportedNetwork
        ? "Switch your wallet to Base Sepolia testnet to check withdrawals or refunds."
        : !hasBuilderCode
          ? "Withdrawals and refunds are turned off until this app is fully set up."
          : hasReadError
            ? "We couldn’t check this pot’s current rules. Refresh the page and try again."
            : isVerifying || !chainDataReady
                ? "Checking whether this pot can be withdrawn or refunded…"
              : registrationQuery.data !== true
                  ? "This pot was not created by the configured POT contract."
                : !potDetailsMatch
                  ? "The displayed organizer or payout wallet does not match the pot contract."
                : !tokenVerified
                    ? "This pot does not use the verified USDC test token on Base Sepolia."
                  : paidOutQuery.data
                      ? pot.fundingMode === 2 || pot.fundingMode === 3
                        ? "The approved wallet has withdrawn the remaining funds. No further withdrawal or refund is available."
                        : "The organizer has withdrawn the money. No further withdrawal or refund is available."
                    : refundEligibleQuery.data
                      ? refundAllowed
                          ? "You can claim your contribution back once."
                        : contributionQuery.data === BigInt(0)
                            ? "The deadline passed below the goal, but this wallet has no contribution to refund."
                          : refundClaimedQuery.data
                              ? "You have already claimed your refund."
                              : "This wallet cannot claim a refund from this pot."
                      : payoutEligibleQuery.data
                        ? payoutAllowed
                            ? pot.fundingMode === 2 || pot.fundingMode === 3
                              ? "The approved wallet can withdraw the available funds."
                              : "The organizer can withdraw the money."
                            : pot.fundingMode === 2 || pot.fundingMode === 3
                              ? "Only the approved payout wallet can withdraw these funds."
                              : "Only the organizer can withdraw these funds."
                        : pot.targetBased
                          ? pot.fundingMode === 2
                            ? "The approved wallet can withdraw after the deadline, whether or not the goal was reached."
                            : pot.fundingMode === 3
                              ? "The approved wallet can withdraw the available balance at any time. Contributions stay open until the deadline, even after the goal is reached."
                              : "The organizer can withdraw only after the group reaches its goal."
                          : "The organizer can withdraw after the first contribution is confirmed.";

  return (
    <section className="pot-settlement" aria-labelledby="pot-settlement-title">
      <div className="pot-settlement-heading">
        <div>
          <p className="pot-eyebrow">WITHDRAWALS AND REFUNDS</p>
          <h2 id="pot-settlement-title">Payouts and refunds</h2>
        </div>
        <span className="pot-settlement-token">USDC testnet</span>
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
            Available to withdraw:{" "}
            <strong>
              {formatUsdcBaseUnits(
                availableToWithdraw > BigInt(0) ? availableToWithdraw : BigInt(0),
              )} USDC
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
