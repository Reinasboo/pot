"use client";

import { useRef, useState, type FormEvent } from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  getBuilderDataSuffix,
  requireBuilderDataSuffix,
} from "@/lib/builder-attribution";
import { PotMetadataEditor } from "@/components/pot-metadata-editor";
import { supportedChain } from "@/lib/wagmi";
import {
  getCrowdfundingCreateArguments,
  formatPotPlan,
  getPotFactoryCreateArguments,
  isCrowdfundingMode,
  validatePotDraft,
  type PotDraft,
} from "@/lib/pot-creation";
import {
  circleBaseSepoliaUsdc,
  getConfiguredPotFactoryAddress,
  getCreatedPotAddress,
  potFactoryAbi,
} from "@/lib/pot-factory";

type Draft = PotDraft;

type StoredDraft = {
  version: 1;
  draft: Omit<Draft, "purpose" | "payoutRecipient" | "isPublic"> & {
    purpose?: string;
    payoutRecipient?: string;
    isPublic?: boolean;
  };
};

const draftStorageKey = "pot.create-draft.v1";
const draftStorageEvent = "pot-local-draft-change";

const initialDraft: Draft = {
  name: "",
  purpose: "",
  mode: "target",
  target: "",
  deadline: "",
  minimum: "",
  payoutRecipient: "",
  isPublic: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredDraft(value: unknown): value is StoredDraft {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.draft))
    return false;
  const draft = value.draft;
  return (
    typeof draft.name === "string" &&
    draft.name.length <= 120 &&
    (draft.purpose === undefined ||
      (typeof draft.purpose === "string" &&
        Array.from(draft.purpose).length <= 2000)) &&
    (draft.mode === "target" ||
      draft.mode === "flexible" ||
      draft.mode === "crowdfunding-deadline" ||
      draft.mode === "crowdfunding-anytime") &&
    typeof draft.target === "string" &&
    draft.target.length <= 120 &&
    typeof draft.deadline === "string" &&
    draft.deadline.length <= 32 &&
    typeof draft.minimum === "string" &&
    draft.minimum.length <= 120 &&
    (draft.payoutRecipient === undefined ||
      (typeof draft.payoutRecipient === "string" &&
        draft.payoutRecipient.length <= 64)) &&
    (draft.isPublic === undefined || typeof draft.isPublic === "boolean")
  );
}

function subscribeToDraftStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(draftStorageEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(draftStorageEvent, onChange);
  };
}

function getDraftStorageSnapshot(): boolean | "unavailable" {
  try {
    return window.localStorage.getItem(draftStorageKey) !== null;
  } catch {
    return "unavailable";
  }
}

function formatDeadline(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PotCreationDraft({
  template,
}: {
  template?: Pick<PotDraft, "name" | "purpose" | "target" | "minimum">;
}) {
  const previewRef = useRef<HTMLElement>(null);
  const errorsRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...initialDraft,
    ...template,
  }));
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "save" | "restore" | "clear" | null
  >(null);
  const [transactionHash, setTransactionHash] = useState<`0x${string}`>();
  const [transactionError, setTransactionError] = useState("");
  const { address: walletAddress, chainId, isConnected } = useAccount();
  const {
    switchChain,
    isPending: isSwitchingChain,
    error: switchChainError,
  } = useSwitchChain();
  const factoryAddress = getConfiguredPotFactoryAddress();
  const rawFactoryAddress = process.env.NEXT_PUBLIC_POT_FACTORY_ADDRESS?.trim();
  const builderDataSuffix = getBuilderDataSuffix();
  const {
    data: factoryToken,
    isError: isFactoryReadError,
    isLoading: isFactoryLoading,
  } = useReadContract({
    address: factoryAddress,
    abi: potFactoryAbi,
    functionName: "token",
    chainId: supportedChain.id,
    query: { enabled: Boolean(factoryAddress) },
  });
  const {
    writeContractAsync,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();
  const {
    data: receipt,
    isError: isReceiptError,
    isLoading: isReceiptLoading,
  } = useWaitForTransactionReceipt({
    chainId: supportedChain.id,
    hash: transactionHash,
    query: { enabled: Boolean(transactionHash) },
  });
  const createdPotAddress =
    receipt?.status === "success"
      ? getCreatedPotAddress(receipt.logs)
      : undefined;
  const wrongNetwork = isConnected && chainId !== supportedChain.id;
  const factoryUsesUsdc =
    factoryToken?.toLowerCase() === circleBaseSepoliaUsdc.toLowerCase();
  const {
    data: crowdfundingSupported,
    isError: isCrowdfundingCapabilityError,
  } = useReadContract({
    address: factoryAddress,
    abi: potFactoryAbi,
    functionName: "crowdfundingEnabled",
    chainId: supportedChain.id,
    query: { enabled: Boolean(factoryAddress) },
  });
  const creationReady = Boolean(
    factoryAddress &&
    factoryUsesUsdc &&
    builderDataSuffix &&
    isConnected &&
    walletAddress &&
    !wrongNetwork,
  );
  const selectedModeReady =
    creationReady &&
    (!isCrowdfundingMode(draft.mode) || crowdfundingSupported === true);
  const hasSavedDraft = useSyncExternalStore(
    subscribeToDraftStorage,
    getDraftStorageSnapshot,
    () => null,
  );

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors([]);
    setShowPreview(false);
    setStorageMessage("");
    setExportMessage("");
  }

  function saveDraft(confirmed = false) {
    if (hasSavedDraft === true && !confirmed) {
      setPendingAction("save");
      return;
    }

    try {
      const savedDraft: StoredDraft = { version: 1, draft };
      window.localStorage.setItem(draftStorageKey, JSON.stringify(savedDraft));
      window.dispatchEvent(new Event(draftStorageEvent));
      setPendingAction(null);
      setStorageMessage("Draft saved in this browser on this device.");
    } catch (error) {
      console.error("Could not save local pot draft", error);
      setStorageMessage(
        "Couldn’t save the draft. Check browser storage settings and try again.",
      );
    }
  }

  function restoreDraft(confirmed = false) {
    const hasCurrentInput =
      JSON.stringify(draft) !== JSON.stringify(initialDraft);
    if (hasSavedDraft === true && hasCurrentInput && !confirmed) {
      setPendingAction("restore");
      return;
    }

    try {
      const stored = window.localStorage.getItem(draftStorageKey);
      if (stored === null) {
        setStorageMessage("No saved draft was found in this browser.");
        return;
      }

      const parsed: unknown = JSON.parse(stored);
      if (!isStoredDraft(parsed)) {
        setStorageMessage(
          "The saved draft has an unsupported format and could not be restored.",
        );
        return;
      }

      setDraft({
        ...initialDraft,
        ...parsed.draft,
        purpose: parsed.draft.purpose ?? "",
        isPublic: parsed.draft.isPublic ?? true,
      });
      setErrors([]);
      setShowPreview(false);
      setPendingAction(null);
      setStorageMessage(
        "Saved draft restored. Preview the rules to check the current values.",
      );
    } catch (error) {
      console.error("Could not restore local pot draft", error);
      setStorageMessage("Couldn’t read the saved draft from browser storage.");
    }
  }

  function clearDraft(confirmed = false) {
    if (hasSavedDraft === true && !confirmed) {
      setPendingAction("clear");
      return;
    }

    try {
      window.localStorage.removeItem(draftStorageKey);
      window.dispatchEvent(new Event(draftStorageEvent));
      setPendingAction(null);
      setStorageMessage("Saved draft removed from this browser.");
    } catch (error) {
      console.error("Could not clear local pot draft", error);
      setStorageMessage(
        "Couldn’t remove the saved draft from browser storage.",
      );
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validatePotDraft(draft);
    setErrors(nextErrors);
    setShowPreview(nextErrors.length === 0);
    requestAnimationFrame(() => {
      const target = nextErrors.length ? errorsRef.current : previewRef.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: "instant", block: "center" });
    });
  }

  async function createPot() {
    const nextErrors = validatePotDraft(draft);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    if (!factoryAddress || !factoryUsesUsdc || !isConnected || wrongNetwork)
      return;

    try {
      requireBuilderDataSuffix();
      setTransactionError("");
      setTransactionHash(undefined);
      const hash = isCrowdfundingMode(draft.mode)
        ? await writeContractAsync({
            address: factoryAddress,
            abi: potFactoryAbi,
            functionName: "createCrowdfundingPot",
            args: getCrowdfundingCreateArguments(draft),
            chainId: supportedChain.id,
          })
        : await writeContractAsync({
            address: factoryAddress,
            abi: potFactoryAbi,
            functionName: "createPot",
            args: getPotFactoryCreateArguments(draft),
            chainId: supportedChain.id,
          });
      setTransactionHash(hash);
    } catch (error) {
      setTransactionError(
        error instanceof Error
          ? error.message
          : "The wallet could not submit this transaction.",
      );
    }
  }

  async function copyPlan() {
    try {
      await navigator.clipboard.writeText(formatPotPlan(draft));
      setExportMessage("Plan copied. Paste it into your group chat.");
    } catch {
      setExportMessage(
        "Copy is unavailable in this browser. Download the plan instead.",
      );
    }
  }

  function downloadPlan() {
    const url = URL.createObjectURL(
      new Blob([formatPotPlan(draft)], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "pot-plan.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportMessage(
      "Plan downloaded. You can share the file with your group.",
    );
  }

  return (
    <div className="pot-create-layout" id="main-content" tabIndex={-1}>
      <section
        className="pot-create-form-section"
        aria-labelledby="create-form-title"
      >
        <div className="pot-create-intro">
          <p className="pot-eyebrow">PLAN PREVIEW</p>
          <h1 id="create-form-title">Plan a group fund.</h1>
          <p>
            Name your goal and choose the rules. Save your draft or share the
            preview with your group. This preview does not create a public pot
            or collect money.
          </p>
        </div>

        <form className="pot-create-form" onSubmit={handleSubmit} noValidate>
          <div className="pot-form-field">
            <label htmlFor="pot-name">Pot name</label>
            <input
              autoComplete="off"
              id="pot-name"
              maxLength={120}
              onChange={(event) => updateDraft({ name: event.target.value })}
              placeholder="What are you planning together?"
              value={draft.name}
            />
            <span className="pot-form-hint">
              Up to 80 bytes of text. Emoji and some letters use more than one
              byte.
            </span>
          </div>

          <div className="pot-form-field">
            <label htmlFor="pot-purpose">
              What is this pot for? <span>(optional)</span>
            </label>
            <textarea
              id="pot-purpose"
              maxLength={4000}
              onChange={(event) => updateDraft({ purpose: event.target.value })}
              placeholder="Give contributors a little context about the shared plan."
              rows={4}
              value={draft.purpose}
            />
            <span className="pot-form-hint">
              {Array.from(draft.purpose).length.toLocaleString()} / 2,000
              characters. Saved with your local draft; publish separately after
              creating the pot.
            </span>
          </div>

          <fieldset className="pot-mode-fieldset">
            <legend>What should happen to the money?</legend>
            <label
              className={`pot-mode-option${draft.mode === "target" ? " is-selected" : ""}`}
            >
              <input
                checked={draft.mode === "target"}
                name="settlement-mode"
                onChange={() => updateDraft({ mode: "target" })}
                type="radio"
                value="target"
              />
              <span>
                <strong>Refund contributors if we miss the goal</strong>
                <span>
                  Set an amount and deadline. If time runs out before the goal
                  is reached, each contributor can claim back their own
                  contribution. Refunds are not automatic.
                </span>
              </span>
            </label>
            <label
              className={`pot-mode-option${draft.mode === "crowdfunding-deadline" ? " is-selected" : ""}`}
            >
              <input
                checked={draft.mode === "crowdfunding-deadline"}
                name="settlement-mode"
                onChange={() => updateDraft({ mode: "crowdfunding-deadline" })}
                type="radio"
                value="crowdfunding-deadline"
              />
              <span>
                <strong>Crowdfund until the deadline</strong>
                <span>
                  The goal is a target, not a cap. Keep accepting contributions
                  until the deadline, then the approved wallet can withdraw all
                  funds—whether or not the goal was reached. No refunds.
                </span>
              </span>
            </label>
            <label
              className={`pot-mode-option${draft.mode === "crowdfunding-anytime" ? " is-selected" : ""}`}
            >
              <input
                checked={draft.mode === "crowdfunding-anytime"}
                name="settlement-mode"
                onChange={() => updateDraft({ mode: "crowdfunding-anytime" })}
                type="radio"
                value="crowdfunding-anytime"
              />
              <span>
                <strong>
                  Let the approved wallet withdraw as funds come in
                </strong>
                <span>
                  The goal is a target, not a cap. The approved wallet can
                  withdraw the available balance at any time, while
                  contributions stay open until the deadline. No refunds.
                </span>
              </span>
            </label>
          </fieldset>

          {draft.mode === "flexible" && (
            <p className="pot-form-errors" role="alert">
              This saved plan uses an organizer-decides rule that is no longer
              available for new pots. Choose a goal-based or crowdfunding rule
              instead.
            </p>
          )}

          {draft.mode !== "flexible" && (
            <div className="pot-form-two-column">
              <div className="pot-form-field">
                <label htmlFor="pot-goal">
                  {isCrowdfundingMode(draft.mode)
                    ? "Fundraising goal"
                    : "Funding goal"}
                </label>
                <input
                  autoComplete="off"
                  id="pot-goal"
                  inputMode="decimal"
                  onChange={(event) =>
                    updateDraft({ target: event.target.value })
                  }
                  placeholder="0.00"
                  value={draft.target}
                />
              </div>
              <div className="pot-form-field">
                <label htmlFor="pot-deadline">Deadline</label>
                <input
                  id="pot-deadline"
                  onChange={(event) =>
                    updateDraft({ deadline: event.target.value })
                  }
                  type="datetime-local"
                  value={draft.deadline}
                />
              </div>
            </div>
          )}

          {isCrowdfundingMode(draft.mode) && (
            <div className="pot-form-field">
              <label htmlFor="pot-payout-recipient">
                Approved payout wallet
              </label>
              <input
                autoComplete="off"
                id="pot-payout-recipient"
                inputMode="text"
                onChange={(event) =>
                  updateDraft({ payoutRecipient: event.target.value })
                }
                placeholder="0x..."
                value={draft.payoutRecipient}
              />
              <span className="pot-form-hint">
                Contributors can see this address before they contribute. Only
                this wallet can withdraw crowdfunding funds.
              </span>
            </div>
          )}

          <div className="pot-form-field">
            <label htmlFor="pot-minimum">
              Smallest amount someone can contribute
            </label>
            <input
              autoComplete="off"
              id="pot-minimum"
              inputMode="decimal"
              onChange={(event) => updateDraft({ minimum: event.target.value })}
              placeholder="0.00"
              value={draft.minimum}
            />
            <span className="pot-form-hint">
              Enter an amount in USDC. Contributions use USDC on Base Sepolia
              testnet.
            </span>
          </div>

          <fieldset className="pot-visibility-options">
            <legend>Who should be able to open this pot?</legend>
            <label>
              <input
                checked={draft.isPublic ?? true}
                name="pot-visibility"
                onChange={() => updateDraft({ isPublic: true })}
                type="radio"
              />
              <span>
                <strong>Anyone</strong> — the pot can be found and opened by
                everyone.
              </span>
            </label>
            <label>
              <input
                checked={draft.isPublic === false}
                name="pot-visibility"
                onChange={() => updateDraft({ isPublic: false })}
                type="radio"
              />
              <span>
                <strong>Only people with a private link</strong> — keep it out
                of public listings.
              </span>
            </label>
            <p className="pot-form-hint">
              A private link works like a key. Anyone who has it can open and
              share the pot in POT. The pot address and transactions are still
              public on Base.
            </p>
          </fieldset>

          {errors.length > 0 && (
            <div
              className="pot-form-errors"
              role="alert"
              ref={errorsRef}
              tabIndex={-1}
            >
              <p>Check these details:</p>
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <button className="pot-create-preview-button" type="submit">
            Preview this plan
          </button>
          <div className="pot-draft-actions" aria-label="Local draft actions">
            <button type="button" onClick={() => saveDraft()}>
              Save draft on this device
            </button>
            <button type="button" onClick={() => restoreDraft()}>
              Restore saved draft
            </button>
            <button type="button" onClick={() => clearDraft()}>
              Clear saved draft
            </button>
          </div>
          {pendingAction && (
            <div
              className="pot-draft-confirmation"
              role="group"
              aria-label="Confirm local draft action"
            >
              <p>
                {pendingAction === "save"
                  ? "A saved draft already exists on this device. Replace it?"
                  : pendingAction === "restore"
                    ? "Restoring will replace the values currently in the form. Continue?"
                    : "Remove the saved draft from this device? This cannot be undone."}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (pendingAction === "save") saveDraft(true);
                  else if (pendingAction === "restore") restoreDraft(true);
                  else clearDraft(true);
                }}
              >
                {pendingAction === "save"
                  ? "Replace saved draft"
                  : pendingAction === "restore"
                    ? "Replace form values"
                    : "Clear saved draft"}
              </button>
              <button type="button" onClick={() => setPendingAction(null)}>
                Cancel
              </button>
            </div>
          )}
        </form>

        <p
          className="pot-create-storage-message"
          role="status"
          aria-live="polite"
        >
          {storageMessage ||
            (hasSavedDraft === true
              ? "A saved draft is available in this browser. Restore it to fill in this form."
              : hasSavedDraft === false
                ? "No saved draft on this device. Drafts stay in this browser and are not published."
                : hasSavedDraft === "unavailable"
                  ? "Browser storage is unavailable. Drafts cannot be saved on this device."
                  : "Checking this browser for a saved draft…")}
        </p>
        <p className="pot-create-unavailable">
          {rawFactoryAddress && !factoryAddress
            ? "Pot creation is unavailable because its factory address is invalid."
            : !factoryAddress
              ? "You can preview and save this plan, but you cannot create a public pot yet. The POT contract has not been deployed."
              : isFactoryLoading
                ? "Checking whether pot creation is available…"
                : isFactoryReadError
                  ? "We couldn’t verify the pot contract on Base Sepolia. Check back later."
                  : factoryToken && !factoryUsesUsdc
                    ? "Pot creation is unavailable because this contract does not use Base Sepolia test USDC."
                    : !builderDataSuffix
                      ? "Pot creation is not available until the required transaction attribution is set up."
                      : isCrowdfundingMode(draft.mode) &&
                          isCrowdfundingCapabilityError
                        ? "This factory does not support crowdfunding. A newer verified pot factory is required."
                        : isCrowdfundingMode(draft.mode) &&
                            crowdfundingSupported !== true
                          ? "Crowdfunding cannot be created until a compatible pot factory is deployed."
                          : !isConnected
                            ? "Connect a wallet to create this pot."
                            : wrongNetwork
                              ? "Switch your wallet to Base Sepolia before creating a pot."
                              : "Your wallet will ask you to confirm before a pot is created. The description is published separately only if you choose to sign for it."}
        </p>
        {showPreview && (
          <div className="pot-create-submit">
            {!isConnected && <Link href="/connect">Connect wallet</Link>}
            {wrongNetwork && (
              <button
                disabled={isSwitchingChain}
                onClick={() => switchChain({ chainId: supportedChain.id })}
                type="button"
              >
                {isSwitchingChain
                  ? "Switching network…"
                  : `Switch to ${supportedChain.name}`}
              </button>
            )}
            <button
              className="pot-create-preview-button"
              disabled={
                !selectedModeReady || isWritePending || isReceiptLoading
              }
              onClick={() => void createPot()}
              type="button"
            >
              {isWritePending
                ? "Confirm in your wallet…"
                : isReceiptLoading
                  ? "Waiting for Base Sepolia to confirm…"
                  : "Create pot"}
            </button>
          </div>
        )}
        {(transactionError ||
          writeError ||
          switchChainError ||
          isReceiptError) && (
          <p className="pot-form-errors" role="alert">
            {transactionError ||
              writeError?.message ||
              switchChainError?.message ||
              "The transaction was submitted but its confirmation could not be verified. Check the transaction in the Base Sepolia explorer before retrying."}
          </p>
        )}
        {transactionHash && (
          <p
            className="pot-create-storage-message"
            role="status"
            aria-live="polite"
          >
            {receipt?.status === "reverted" ? (
              <>
                Transaction reverted.{" "}
                <a
                  href={`${supportedChain.blockExplorers.default.url}/tx/${transactionHash}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Inspect the failed transaction
                </a>
                .
              </>
            ) : receipt?.status === "success" ? (
              createdPotAddress ? (
                <>
                  Pot created at{" "}
                  <a
                    href={`${supportedChain.blockExplorers.default.url}/address/${createdPotAddress}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {createdPotAddress}
                  </a>
                  .{" "}
                  <a
                    href={`${supportedChain.blockExplorers.default.url}/tx/${transactionHash}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View transaction
                  </a>
                  .
                </>
              ) : (
                <>
                  Transaction confirmed, but no PotCreated event was found.{" "}
                  <a
                    href={`${supportedChain.blockExplorers.default.url}/tx/${transactionHash}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Inspect the transaction
                  </a>{" "}
                  before retrying.
                </>
              )
            ) : isReceiptError ? (
              <>
                Could not verify the transaction receipt.{" "}
                <a
                  href={`${supportedChain.blockExplorers.default.url}/tx/${transactionHash}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Check its status before retrying
                </a>
                .
              </>
            ) : (
              <>
                Transaction submitted.{" "}
                <a
                  href={`${supportedChain.blockExplorers.default.url}/tx/${transactionHash}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  View pending transaction
                </a>
                .
              </>
            )}
          </p>
        )}
        {receipt?.status === "success" &&
          createdPotAddress &&
          walletAddress && (
            <div className="pot-create-published-metadata">
              <p>
                Your pot’s rules are onchain. Choose who can open the POT page
                below and sign to save.
              </p>
              <PotMetadataEditor
                address={createdPotAddress}
                organizer={walletAddress}
                initialIsPublic={draft.isPublic ?? true}
                isPersisted={false}
                initialDescription={draft.purpose.trim()}
              />
            </div>
          )}
      </section>

      <aside
        className="pot-create-preview"
        aria-live="polite"
        ref={previewRef}
        tabIndex={-1}
      >
        <p className="pot-eyebrow">
          {showPreview ? "YOUR PLAN PREVIEW" : "WHAT YOU’RE PLANNING"}
        </p>
        {showPreview ? (
          <>
            <h2>{draft.name.trim()}</h2>
            {draft.purpose.trim() && (
              <p className="pot-create-preview-purpose">
                {draft.purpose.trim()}
              </p>
            )}
            <dl className="pot-create-preview-details">
              <div>
                <dt>Money rules</dt>
                <dd>
                  {draft.mode === "target"
                    ? "Goal + deadline; refund if missed"
                    : draft.mode === "flexible"
                      ? "Organizer decides (not available for new pots)"
                      : draft.mode === "crowdfunding-deadline"
                        ? "Crowdfunding; payout after deadline"
                        : "Crowdfunding; approved wallet may withdraw anytime"}
                </dd>
              </div>
              {draft.mode !== "flexible" && (
                <>
                  <div>
                    <dt>
                      {isCrowdfundingMode(draft.mode)
                        ? "Fundraising goal"
                        : "Goal"}
                    </dt>
                    <dd>{draft.target} USDC</dd>
                  </div>
                  <div>
                    <dt>Deadline</dt>
                    <dd>{formatDeadline(draft.deadline)}</dd>
                  </div>
                </>
              )}
              {isCrowdfundingMode(draft.mode) && (
                <div>
                  <dt>Approved payout wallet</dt>
                  <dd>{draft.payoutRecipient}</dd>
                </div>
              )}
              <div>
                <dt>Smallest contribution</dt>
                <dd>{draft.minimum} USDC</dd>
              </div>
              <div>
                <dt>Who can open it?</dt>
                <dd>
                  {draft.isPublic === false
                    ? "Only people with the private link"
                    : "Anyone"}
                </dd>
              </div>
            </dl>
            <p className="pot-create-preview-purpose">
              {draft.mode === "target"
                ? "The organizer can withdraw after the goal is reached. If the deadline passes below the goal, contributors can claim back their own contributions."
                : draft.mode === "flexible"
                  ? "There is no goal, deadline, or refund rule. After the first contribution, the organizer can withdraw the money."
                  : draft.mode === "crowdfunding-deadline"
                    ? "The goal is a target, not a cap. Contributions stay open until the deadline, when the named wallet can withdraw all funds. Contributors cannot claim refunds under this rule."
                    : "The goal is a target, not a cap. The named wallet can withdraw the current balance at any time, and contributions stay open until the deadline. Contributors cannot claim refunds under this rule."}
            </p>
            <p className="pot-create-preview-note">
              This is a planning preview, not a payment request. Use Save draft
              to keep it on this device, or copy or download the rules to share
              with your group.
            </p>
            <div className="plan-export-actions">
              <button type="button" onClick={() => void copyPlan()}>
                Copy plan
              </button>
              <button type="button" onClick={downloadPlan}>
                Download plan
              </button>
            </div>
            <p className="plan-export-feedback" role="status">
              {exportMessage}
            </p>
          </>
        ) : (
          <div className="pot-create-preview-empty">
            <h2>Your group-fund plan</h2>
            <p>
              Add a name, choose what happens to the money, and set the goal and
              deadline. For crowdfunding, name the wallet that will receive
              withdrawals.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
