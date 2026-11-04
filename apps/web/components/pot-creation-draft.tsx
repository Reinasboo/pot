"use client";

import { useState, type FormEvent } from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { getBuilderDataSuffix, requireBuilderDataSuffix } from "@/lib/builder-attribution";
import { PotMetadataEditor } from "@/components/pot-metadata-editor";
import { supportedChain } from "@/lib/wagmi";
import {
  getPotFactoryCreateArguments,
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
  draft: Omit<Draft, "purpose"> & { purpose?: string };
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredDraft(value: unknown): value is StoredDraft {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.draft)) return false;
  const draft = value.draft;
  return (
    typeof draft.name === "string" &&
    draft.name.length <= 120 &&
    (draft.purpose === undefined ||
      (typeof draft.purpose === "string" && Array.from(draft.purpose).length <= 2000)) &&
    (draft.mode === "target" || draft.mode === "flexible") &&
    typeof draft.target === "string" &&
    draft.target.length <= 120 &&
    typeof draft.deadline === "string" &&
    draft.deadline.length <= 32 &&
    typeof draft.minimum === "string" &&
    draft.minimum.length <= 120
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

export function PotCreationDraft() {
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<"save" | "restore" | "clear" | null>(null);
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
  const createdPotAddress = receipt?.status === "success"
    ? getCreatedPotAddress(receipt.logs)
    : undefined;
  const wrongNetwork = isConnected && chainId !== supportedChain.id;
  const factoryUsesUsdc =
    factoryToken?.toLowerCase() === circleBaseSepoliaUsdc.toLowerCase();
  const creationReady = Boolean(
    factoryAddress &&
      factoryUsesUsdc &&
      builderDataSuffix &&
      isConnected &&
      walletAddress &&
      !wrongNetwork,
  );
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
      setStorageMessage("Couldn’t save the draft. Check browser storage settings and try again.");
    }
  }

  function restoreDraft(confirmed = false) {
    const hasCurrentInput = JSON.stringify(draft) !== JSON.stringify(initialDraft);
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
        setStorageMessage("The saved draft has an unsupported format and could not be restored.");
        return;
      }

      setDraft({ ...initialDraft, ...parsed.draft, purpose: parsed.draft.purpose ?? "" });
      setErrors([]);
      setShowPreview(false);
      setPendingAction(null);
      setStorageMessage("Saved draft restored. Preview the rules to check the current values.");
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
      setStorageMessage("Couldn’t remove the saved draft from browser storage.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validatePotDraft(draft);
    setErrors(nextErrors);
    setShowPreview(nextErrors.length === 0);
  }

  async function createPot() {
    const nextErrors = validatePotDraft(draft);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    if (!factoryAddress || !factoryUsesUsdc || !isConnected || wrongNetwork) return;

    try {
      requireBuilderDataSuffix();
      setTransactionError("");
      setTransactionHash(undefined);
      const hash = await writeContractAsync({
        address: factoryAddress,
        abi: potFactoryAbi,
        functionName: "createPot",
        args: getPotFactoryCreateArguments(draft),
        chainId: supportedChain.id,
      });
      setTransactionHash(hash);
    } catch (error) {
      setTransactionError(
        error instanceof Error ? error.message : "The wallet could not submit this transaction.",
      );
    }
  }

  return (
    <div className="pot-create-layout">
      <section className="pot-create-form-section" aria-labelledby="create-form-title">
        <div className="pot-create-intro">
          <p className="pot-eyebrow">POT SETUP</p>
          <h1 id="create-form-title">Set the rules before you share.</h1>
          <p>
            Choose how this pot settles and review the terms. Onchain creation is enabled only
            after the deployed factory and Builder Code have been verified.
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
            <span className="pot-form-hint">Up to 80 UTF-8 bytes.</span>
          </div>

          <div className="pot-form-field">
            <label htmlFor="pot-purpose">What is this pot for? <span>(optional)</span></label>
            <textarea
              id="pot-purpose"
              maxLength={4000}
              onChange={(event) => updateDraft({ purpose: event.target.value })}
              placeholder="Give contributors a little context about the shared plan."
              rows={4}
              value={draft.purpose}
            />
            <span className="pot-form-hint">
              {Array.from(draft.purpose).length.toLocaleString()} / 2,000 characters. Saved with
              your local draft; publish separately after creating the pot.
            </span>
          </div>

          <fieldset className="pot-mode-fieldset">
            <legend>Settlement rules</legend>
            <label className={`pot-mode-option${draft.mode === "target" ? " is-selected" : ""}`}>
              <input
                checked={draft.mode === "target"}
                name="settlement-mode"
                onChange={() => updateDraft({ mode: "target" })}
                type="radio"
                value="target"
              />
              <span>
                <strong>Goal-based</strong>
                <span>Set a target and deadline. Contributors can claim refunds if the deadline passes below the goal.</span>
              </span>
            </label>
            <label className={`pot-mode-option${draft.mode === "flexible" ? " is-selected" : ""}`}>
              <input
                checked={draft.mode === "flexible"}
                name="settlement-mode"
                onChange={() => updateDraft({ mode: "flexible" })}
                type="radio"
                value="flexible"
              />
              <span>
                <strong>Flexible</strong>
                <span>No target or deadline. The organizer may withdraw the collected funds; there is no automatic refund rule.</span>
              </span>
            </label>
          </fieldset>

          {draft.mode === "target" && (
            <div className="pot-form-two-column">
              <div className="pot-form-field">
                <label htmlFor="pot-goal">Funding goal</label>
                <input
                  autoComplete="off"
                  id="pot-goal"
                  inputMode="decimal"
                  onChange={(event) => updateDraft({ target: event.target.value })}
                  placeholder="0.00"
                  value={draft.target}
                />
              </div>
              <div className="pot-form-field">
                <label htmlFor="pot-deadline">Deadline</label>
                <input
                  id="pot-deadline"
                  onChange={(event) => updateDraft({ deadline: event.target.value })}
                  type="datetime-local"
                  value={draft.deadline}
                />
              </div>
            </div>
          )}

          <div className="pot-form-field">
            <label htmlFor="pot-minimum">Minimum contribution</label>
            <input
              autoComplete="off"
              id="pot-minimum"
              inputMode="decimal"
              onChange={(event) => updateDraft({ minimum: event.target.value })}
              placeholder="0.00"
              value={draft.minimum}
            />
            <span className="pot-form-hint">
              Circle USDC on Base Sepolia · 6 decimal places.
            </span>
          </div>

          {errors.length > 0 && (
            <div className="pot-form-errors" role="alert">
              <p>Check these details:</p>
              <ul>
                {errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}

          <button className="pot-create-preview-button" type="submit">
            Preview pot rules
          </button>
          <div className="pot-draft-actions" aria-label="Local draft actions">
            <button type="button" onClick={() => saveDraft()}>Save draft on this device</button>
            <button type="button" onClick={() => restoreDraft()}>Restore saved draft</button>
            <button type="button" onClick={() => clearDraft()}>Clear saved draft</button>
          </div>
          {pendingAction && (
            <div className="pot-draft-confirmation" role="group" aria-label="Confirm local draft action">
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
              <button type="button" onClick={() => setPendingAction(null)}>Cancel</button>
            </div>
          )}
        </form>

        <p className="pot-create-storage-message" role="status" aria-live="polite">
          {storageMessage ||
            (hasSavedDraft === true
              ? "A saved draft is available in this browser. Restoring it will fill this form."
              : hasSavedDraft === false
                ? "No saved draft found in this browser. Drafts are not uploaded or deployed."
                : hasSavedDraft === "unavailable"
                  ? "Browser storage is unavailable. Drafts cannot be saved on this device."
                  : "Checking this browser for a saved draft…")}
        </p>
        <p className="pot-create-unavailable">
          {rawFactoryAddress && !factoryAddress
            ? "Pot creation is unavailable because NEXT_PUBLIC_POT_FACTORY_ADDRESS is invalid."
            : !factoryAddress
              ? "Onchain creation is disabled until a deployed Base Sepolia factory is configured."
              : isFactoryLoading
                ? "Verifying the configured factory and settlement token…"
                : isFactoryReadError
                  ? "The configured address could not be verified as a POT factory on Base Sepolia."
                  : factoryToken && !factoryUsesUsdc
                    ? "Pot creation is disabled: this factory does not use the verified Circle Base Sepolia USDC contract."
                    : !builderDataSuffix
                      ? "Pot creation is disabled until a Base Builder Code is configured."
                      : !isConnected
                        ? "Connect a wallet to create this pot on Base Sepolia."
                        : wrongNetwork
                          ? "Switch your connected wallet to Base Sepolia before creating a pot."
                          : "A transaction is sent only after you confirm it in your wallet. Purpose text is not included onchain and is published only after a separate wallet signature."}
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
                {isSwitchingChain ? "Switching network…" : `Switch to ${supportedChain.name}`}
              </button>
            )}
            <button
              className="pot-create-preview-button"
              disabled={!creationReady || isWritePending || isReceiptLoading}
              onClick={() => void createPot()}
              type="button"
            >
              {isWritePending
                ? "Confirm in your wallet…"
                : isReceiptLoading
                  ? "Waiting for Base Sepolia confirmation…"
                  : "Create pot on Base Sepolia"}
            </button>
          </div>
        )}
        {(transactionError || writeError || switchChainError || isReceiptError) && (
          <p className="pot-form-errors" role="alert">
            {transactionError ||
              writeError?.message ||
              switchChainError?.message ||
              "The transaction was submitted but its confirmation could not be verified. Check the transaction in the Base Sepolia explorer before retrying."}
          </p>
        )}
        {transactionHash && (
          <p className="pot-create-storage-message" role="status" aria-live="polite">
            {receipt?.status === "reverted"
              ? <>Transaction reverted. <a href={`${supportedChain.blockExplorers.default.url}/tx/${transactionHash}`} rel="noreferrer" target="_blank">Inspect the failed transaction</a>.</>
              : receipt?.status === "success"
              ? createdPotAddress
                ? <>Pot created at <a href={`${supportedChain.blockExplorers.default.url}/address/${createdPotAddress}`} rel="noreferrer" target="_blank">{createdPotAddress}</a>. <a href={`${supportedChain.blockExplorers.default.url}/tx/${transactionHash}`} rel="noreferrer" target="_blank">View transaction</a>.</>
                : <>Transaction confirmed, but no PotCreated event was found. <a href={`${supportedChain.blockExplorers.default.url}/tx/${transactionHash}`} rel="noreferrer" target="_blank">Inspect the transaction</a> before retrying.</>
              : isReceiptError
                ? <>Could not verify the transaction receipt. <a href={`${supportedChain.blockExplorers.default.url}/tx/${transactionHash}`} rel="noreferrer" target="_blank">Check its status before retrying</a>.</>
                : <>Transaction submitted. <a href={`${supportedChain.blockExplorers.default.url}/tx/${transactionHash}`} rel="noreferrer" target="_blank">View pending transaction</a>.</>}
          </p>
        )}
        {receipt?.status === "success" && createdPotAddress && walletAddress && (
          <div className="pot-create-published-metadata">
            <p>
              Your pot name and rules are onchain. Its description stays private until you choose
              to publish it below.
            </p>
            <PotMetadataEditor
              address={createdPotAddress}
              organizer={walletAddress}
              isPublic
              initialDescription={draft.purpose.trim()}
            />
            <Link href={`/pot/${createdPotAddress}`}>Open the public pot page</Link>
          </div>
        )}
      </section>

      <aside className="pot-create-preview" aria-live="polite">
        <p className="pot-eyebrow">{showPreview ? "YOUR RULES PREVIEW" : "RULES AT A GLANCE"}</p>
        {showPreview ? (
          <>
            <h2>{draft.name.trim()}</h2>
            {draft.purpose.trim() && <p className="pot-create-preview-purpose">{draft.purpose.trim()}</p>}
            <dl className="pot-create-preview-details">
              <div>
                <dt>Settlement</dt>
                <dd>{draft.mode === "target" ? "Goal-based" : "Flexible"}</dd>
              </div>
              {draft.mode === "target" && (
                <>
                  <div>
                    <dt>Goal</dt>
                    <dd>{draft.target} USDC</dd>
                  </div>
                  <div>
                    <dt>Deadline</dt>
                    <dd>{formatDeadline(draft.deadline)}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Minimum contribution</dt>
                <dd>{draft.minimum} USDC</dd>
              </div>
            </dl>
            <p className="pot-create-preview-note">
              The pot name and settlement rules are sent to the contract. Purpose text is kept
              locally until you separately sign to publish it on the public pot page.
            </p>
          </>
        ) : (
          <div className="pot-create-preview-empty">
            <h2>A clear plan starts with clear rules.</h2>
            <p>
              Add a name and minimum contribution, choose a settlement mode, then preview what
              contributors would see.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
