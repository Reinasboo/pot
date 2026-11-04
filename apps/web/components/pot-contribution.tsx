"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
  usdcAbi,
} from "@/lib/pot-factory";
import {
  formatUsdcBaseUnits,
  parseUsdcContribution,
  validateContribution,
} from "@/lib/pot-contribution";
import { supportedChain } from "@/lib/wagmi";
import type { PublicPotDetails } from "@/lib/public-pot";

type Props = {
  pot: PublicPotDetails;
  onConfirmed: () => void;
};

type TransactionPhase =
  | "idle"
  | "approving"
  | "confirming-approval"
  | "contributing"
  | "confirming-contribution"
  | "confirmed"
  | "failed";
type TransactionKind = "approval" | "contribution";

function isPending(phase: TransactionPhase): boolean {
  return (
    phase === "approving" ||
    phase === "confirming-approval" ||
    phase === "contributing" ||
    phase === "confirming-contribution"
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The wallet transaction could not be completed.";
}

export function PotContribution({ pot, onConfirmed }: Props) {
  const [amountInput, setAmountInput] = useState("");
  const [phase, setPhase] = useState<TransactionPhase>("idle");
  const [transactionHash, setTransactionHash] = useState<`0x${string}`>();
  const [transactionKind, setTransactionKind] = useState<TransactionKind>("contribution");
  const [transactionError, setTransactionError] = useState("");
  const [amountErrors, setAmountErrors] = useState<string[]>([]);
  const { address: walletAddress, chainId, isConnected } = useAccount();
  const accountRef = useRef({ address: walletAddress, chainId });
  useEffect(() => {
    accountRef.current = { address: walletAddress, chainId };
  }, [walletAddress, chainId]);
  const { switchChain, isPending: isSwitchingChain, error: switchChainError } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: supportedChain.id });
  const factoryAddress = getConfiguredPotFactoryAddress();
  const builderDataSuffix = getBuilderDataSuffix();
  const onSupportedNetwork = isConnected && chainId === supportedChain.id;
  const canRead = Boolean(factoryAddress && onSupportedNetwork);

  const factoryTokenQuery = useReadContract({
    address: factoryAddress,
    abi: potFactoryAbi,
    functionName: "token",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const registrationQuery = useReadContract({
    address: factoryAddress,
    abi: potFactoryAbi,
    functionName: "isPot",
    args: [pot.address],
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
  const contributionOpenQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "isContributionOpen",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const minimumQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "minimumContribution",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const targetBasedQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "targetBased",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const targetQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "targetAmount",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const totalQuery = useReadContract({
    address: pot.address,
    abi: potContractAbi,
    functionName: "totalContributed",
    chainId: supportedChain.id,
    query: { enabled: canRead },
  });
  const balanceQuery = useReadContract({
    address: circleBaseSepoliaUsdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [walletAddress ?? circleBaseSepoliaUsdc],
    chainId: supportedChain.id,
    query: { enabled: canRead && Boolean(walletAddress) },
  });
  const allowanceQuery = useReadContract({
    address: circleBaseSepoliaUsdc,
    abi: usdcAbi,
    functionName: "allowance",
    args: [walletAddress ?? circleBaseSepoliaUsdc, pot.address],
    chainId: supportedChain.id,
    query: { enabled: canRead && Boolean(walletAddress) },
  });

  const readQueries = [
    factoryTokenQuery,
    registrationQuery,
    potTokenQuery,
    contributionOpenQuery,
    minimumQuery,
    targetBasedQuery,
    targetQuery,
    totalQuery,
  ];
  const hasReadError = readQueries.some((query) => query.isError);
  const isVerifying = canRead && readQueries.some((query) => query.isLoading);
  const usesVerifiedUsdc =
    factoryTokenQuery.data?.toLowerCase() === circleBaseSepoliaUsdc.toLowerCase() &&
    potTokenQuery.data?.toLowerCase() === circleBaseSepoliaUsdc.toLowerCase();
  const chainReadsReady =
    factoryTokenQuery.data !== undefined &&
    registrationQuery.data === true &&
    potTokenQuery.data !== undefined &&
    contributionOpenQuery.data !== undefined &&
    minimumQuery.data !== undefined &&
    targetBasedQuery.data !== undefined &&
    targetQuery.data !== undefined &&
    totalQuery.data !== undefined;
  const amount = parseUsdcContribution(amountInput);
  const rulesReady =
    minimumQuery.data !== undefined &&
    targetBasedQuery.data !== undefined &&
    targetQuery.data !== undefined &&
    totalQuery.data !== undefined &&
    balanceQuery.data !== undefined;
  const liveAmountErrors =
    amount && rulesReady
      ? validateContribution(amount, {
          minimum: minimumQuery.data,
          targetBased: targetBasedQuery.data,
          target: targetQuery.data,
          totalContributed: totalQuery.data,
          balance: balanceQuery.data,
        })
      : [];
  const visibleAmountErrors = amountErrors.length > 0 ? amountErrors : amount ? liveAmountErrors : [];
  const goalRemaining =
    targetBasedQuery.data && targetQuery.data !== undefined && totalQuery.data !== undefined
      ? targetQuery.data > totalQuery.data
        ? targetQuery.data - totalQuery.data
        : BigInt(0)
      : undefined;
  const suggestions =
    rulesReady && minimumQuery.data !== undefined
      ? [
          minimumQuery.data,
          minimumQuery.data * BigInt(2),
          minimumQuery.data * BigInt(5),
          ...(goalRemaining !== undefined && goalRemaining < minimumQuery.data
            ? [goalRemaining]
            : []),
        ]
          .filter((suggestion, index, values) => values.indexOf(suggestion) === index)
          .filter(
            (suggestion) =>
              suggestion > BigInt(0) &&
              suggestion <= balanceQuery.data! &&
              (goalRemaining === undefined || suggestion <= goalRemaining),
          )
      : [];

  const ready =
    Boolean(
      factoryAddress &&
        isConnected &&
        walletAddress &&
        onSupportedNetwork &&
        builderDataSuffix &&
        chainReadsReady &&
        usesVerifiedUsdc &&
        contributionOpenQuery.data === true &&
        balanceQuery.data !== undefined &&
        allowanceQuery.data !== undefined &&
        !balanceQuery.isError &&
        !allowanceQuery.isError,
    ) && !isPending(phase);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAmountErrors([]);
    setTransactionError("");
    setTransactionHash(undefined);
    setTransactionKind("contribution");
    setPhase("idle");

    if (!amount) {
      setAmountErrors(["Enter a positive amount with up to 6 decimal places."]);
      return;
    }
    if (!isConnected || !walletAddress || !publicClient || !factoryAddress) {
      setTransactionError("Connect a wallet and verify the configured Base Sepolia factory first.");
      return;
    }
    if (chainId !== supportedChain.id) {
      setTransactionError("Switch your wallet to Base Sepolia before contributing.");
      return;
    }

    try {
      requireBuilderDataSuffix();

      const [
        isRegistered,
        factoryToken,
        potToken,
        isOpen,
        minimum,
        targetBased,
        target,
        totalContributed,
        balance,
        allowance,
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
          functionName: "isContributionOpen",
        }),
        publicClient.readContract({
          address: pot.address,
          abi: potContractAbi,
          functionName: "minimumContribution",
        }),
        publicClient.readContract({
          address: pot.address,
          abi: potContractAbi,
          functionName: "targetBased",
        }),
        publicClient.readContract({
          address: pot.address,
          abi: potContractAbi,
          functionName: "targetAmount",
        }),
        publicClient.readContract({
          address: pot.address,
          abi: potContractAbi,
          functionName: "totalContributed",
        }),
        publicClient.readContract({
          address: circleBaseSepoliaUsdc,
          abi: usdcAbi,
          functionName: "balanceOf",
          args: [walletAddress],
        }),
        publicClient.readContract({
          address: circleBaseSepoliaUsdc,
          abi: usdcAbi,
          functionName: "allowance",
          args: [walletAddress, pot.address],
        }),
      ]);

      if (!isRegistered) throw new Error("This pot is not registered by the configured factory.");
      if (
        factoryToken.toLowerCase() !== circleBaseSepoliaUsdc.toLowerCase() ||
        potToken.toLowerCase() !== circleBaseSepoliaUsdc.toLowerCase()
      ) {
        throw new Error("This pot does not use the verified Circle Base Sepolia USDC contract.");
      }
      if (!isOpen) throw new Error("This pot is no longer accepting contributions.");

      const validationErrors = validateContribution(amount, {
        minimum,
        targetBased,
        target,
        totalContributed,
        balance,
      });
      if (validationErrors.length > 0) {
        setAmountErrors(validationErrors);
        return;
      }

      const connectedAccount = accountRef.current;
      if (
        connectedAccount.address?.toLowerCase() !== walletAddress.toLowerCase() ||
        connectedAccount.chainId !== supportedChain.id
      ) {
        throw new Error("Your connected wallet or network changed. Verify it and try again.");
      }

      if (allowance < amount) {
        setPhase("approving");
        const approvalHash = await writeContractAsync({
          address: circleBaseSepoliaUsdc,
          abi: usdcAbi,
          functionName: "approve",
          args: [pot.address, amount],
          account: walletAddress,
          chainId: supportedChain.id,
        });
        setTransactionKind("approval");
        setTransactionHash(approvalHash);
        setPhase("confirming-approval");
        const approvalReceipt = await publicClient.waitForTransactionReceipt({
          hash: approvalHash,
        });
        if (approvalReceipt.status !== "success") {
          throw new Error("USDC approval failed onchain. No contribution was submitted.");
        }

        const afterApproval = accountRef.current;
        if (
          afterApproval.address?.toLowerCase() !== walletAddress.toLowerCase() ||
          afterApproval.chainId !== supportedChain.id
        ) {
          throw new Error("The wallet changed after approval. Reconnect the original wallet to continue.");
        }
      }

      setPhase("contributing");
      const contributionHash = await writeContractAsync({
        address: pot.address,
        abi: potContractAbi,
        functionName: "contribute",
        args: [amount],
        account: walletAddress,
        chainId: supportedChain.id,
      });
      setTransactionKind("contribution");
      setTransactionHash(contributionHash);
      setPhase("confirming-contribution");
      const contributionReceipt = await publicClient.waitForTransactionReceipt({
        hash: contributionHash,
      });
      if (contributionReceipt.status !== "success") {
        throw new Error("The contribution transaction reverted. No funds were added to the pot.");
      }

      setPhase("confirmed");
      onConfirmed();
      try {
        await Promise.all([
          balanceQuery.refetch(),
          allowanceQuery.refetch(),
          contributionOpenQuery.refetch(),
        ]);
      } catch (error) {
        console.error("Contribution confirmed but wallet state could not be refreshed", error);
        setTransactionError(
          "Contribution confirmed, but wallet details could not be refreshed. Reload the page to verify the latest state.",
        );
      }
    } catch (error) {
      setPhase("failed");
      setTransactionError(getErrorMessage(error));
    }
  }

  const disabledReason = !factoryAddress
    ? "You cannot contribute yet. POT has not deployed the contract that holds pot money."
    : !isConnected
      ? "Connect your wallet to contribute."
      : !onSupportedNetwork
        ? "Switch your wallet to Base Sepolia testnet before contributing."
        : !builderDataSuffix
          ? "Contributions are turned off until this app is fully set up."
          : hasReadError || balanceQuery.isError || allowanceQuery.isError
            ? "We couldn’t check this pot or your test USDC balance. Refresh the page and try again."
            : isVerifying || !chainReadsReady
              ? "Checking this pot and your test USDC…"
              : registrationQuery.data !== true
                ? "This pot was not created by the configured POT contract."
                : !usesVerifiedUsdc
                  ? "This pot does not use the verified USDC test token on Base Sepolia."
                  : contributionOpenQuery.data !== true
                    ? "This pot is closed to contributions. It may have reached its goal or passed its deadline."
                    : balanceQuery.data === undefined || allowanceQuery.data === undefined
                      ? "Checking your USDC balance and approval…"
                      : "Your contribution will count after Base Sepolia confirms it.";

  const balanceLabel =
    !isConnected
      ? "Connect to see your balance"
      : balanceQuery.data === undefined
      ? "Checking your USDC…"
      : `${formatUsdcBaseUnits(balanceQuery.data)} USDC available`;
  const phaseLabel =
    phase === "approving"
      ? "Confirm the exact USDC approval in your wallet…"
      : phase === "confirming-approval"
        ? "Waiting for USDC approval confirmation…"
        : phase === "contributing"
          ? "Confirm the contribution in your wallet…"
          : phase === "confirming-contribution"
            ? "Waiting for contribution confirmation…"
            : phase === "confirmed"
              ? "Contribution confirmed on Base Sepolia."
              : "";

  return (
    <section className="pot-contribution" aria-labelledby="pot-contribution-title">
      <div className="pot-contribution-heading">
        <h2 id="pot-contribution-title">Contribute USDC</h2>
        <span>{balanceLabel}</span>
      </div>
      {!isConnected && (
        <Link className="pot-contribution-connect" href="/connect">
          Connect wallet
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
      {switchChainError && <p className="pot-contribution-error" role="alert">{switchChainError.message}</p>}
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label className="pot-contribution-label" htmlFor="pot-contribution-amount">
          Amount
        </label>
        <div className="pot-contribution-input-row">
          <input
            autoComplete="off"
            disabled={isPending(phase)}
            id="pot-contribution-amount"
            inputMode="decimal"
            onChange={(event) => {
              setAmountInput(event.target.value);
              setAmountErrors([]);
              if (phase === "failed" || phase === "confirmed") {
                setPhase("idle");
                setTransactionError("");
                setTransactionHash(undefined);
              }
            }}
            placeholder="0.00"
            value={amountInput}
          />
          <span>USDC</span>
        </div>
        {suggestions.length > 0 && (
          <div className="pot-contribution-suggestions" aria-label="Suggested contribution amounts">
            {suggestions.map((suggestion) => {
              const label = formatUsdcBaseUnits(suggestion);
              return (
                <button
                  key={suggestion.toString()}
                  aria-label={`Set contribution amount to ${label} USDC`}
                  disabled={isPending(phase)}
                  onClick={() => {
                    setAmountInput(label);
                    setAmountErrors([]);
                  }}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {visibleAmountErrors.length > 0 && (
          <ul className="pot-contribution-error" role="alert">
            {visibleAmountErrors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        )}
        <p className="pot-contribution-note">{disabledReason}</p>
        <p className="pot-contribution-approval-note">
          Your wallet may ask you to approve this exact amount before contributing. POT never asks
          for permission to spend unlimited USDC.
        </p>
        <button
          className="pot-contribute-button"
          disabled={
            !ready ||
            isPending(phase) ||
            amountInput.trim() === "" ||
            (amount !== undefined && liveAmountErrors.length > 0)
          }
          type="submit"
        >
          {phase === "approving"
            ? "Confirm USDC approval…"
            : phase === "confirming-approval"
              ? "Waiting for approval…"
              : phase === "contributing"
                ? "Confirm contribution…"
                : phase === "confirming-contribution"
                  ? "Waiting for confirmation…"
                  : phase === "confirmed"
                    ? "Contribute again"
                    : "Contribute"}
        </button>
      </form>
      {transactionError && <p className="pot-contribution-error" role="alert">{transactionError}</p>}
      {phaseLabel && <p className="pot-contribution-status" role="status" aria-live="polite">{phaseLabel}</p>}
      {transactionHash && (
        <a
          className="pot-contribution-transaction-link"
          href={`${supportedChain.blockExplorers.default.url}/tx/${transactionHash}`}
          rel="noreferrer"
          target="_blank"
        >
          View {transactionKind} on BaseScan
        </a>
      )}
    </section>
  );
}
