"use client";

import { useState, type FormEvent } from "react";
import { useSyncExternalStore } from "react";

type SettlementMode = "target" | "flexible";
type Draft = {
  name: string;
  purpose: string;
  mode: SettlementMode;
  target: string;
  deadline: string;
  minimum: string;
};

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

function isPositiveAmount(value: string): boolean {
  if (!/^(?:0|[1-9]\d{0,77})(?:\.\d{1,36})?$/.test(value)) return false;
  return value.split(".").some((part) => /[1-9]/.test(part));
}

function compareAmounts(left: string, right: string): number {
  const [leftWhole, leftFraction = ""] = left.split(".");
  const [rightWhole, rightFraction = ""] = right.split(".");
  const normalizedLeft = leftWhole.replace(/^0+(?=\d)/, "");
  const normalizedRight = rightWhole.replace(/^0+(?=\d)/, "");

  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length > normalizedRight.length ? 1 : -1;
  }
  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft > normalizedRight ? 1 : -1;
  }

  const fractionLength = Math.max(leftFraction.length, rightFraction.length);
  const paddedLeft = leftFraction.padEnd(fractionLength, "0");
  const paddedRight = rightFraction.padEnd(fractionLength, "0");
  if (paddedLeft === paddedRight) return 0;
  return paddedLeft > paddedRight ? 1 : -1;
}

function validateDraft(draft: Draft): string[] {
  const errors: string[] = [];
  const name = draft.name.trim();
  if (!name) errors.push("Enter a name for your pot.");
  else if (new TextEncoder().encode(name).length > 80) {
    errors.push("The name must be 80 UTF-8 bytes or fewer.");
  }
  if (Array.from(draft.purpose).length > 2000) {
    errors.push("The purpose must be 2,000 characters or fewer.");
  }

  if (!isPositiveAmount(draft.minimum)) {
    errors.push("Enter a minimum contribution greater than zero, with up to 36 decimal places.");
  }

  if (draft.mode === "target") {
    if (!isPositiveAmount(draft.target)) {
      errors.push("Enter a goal greater than zero, with up to 36 decimal places.");
    }
    if (
      isPositiveAmount(draft.target) &&
      isPositiveAmount(draft.minimum) &&
      compareAmounts(draft.minimum, draft.target) > 0
    ) {
      errors.push("The minimum contribution cannot be greater than the goal.");
    }
    if (!draft.deadline) {
      errors.push("Choose a deadline for a goal-based pot.");
    } else {
      const deadline = new Date(draft.deadline);
      if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now()) {
        errors.push("Choose a deadline in the future.");
      }
    }
  }

  return errors;
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
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    setShowPreview(nextErrors.length === 0);
  }

  return (
    <div className="pot-create-layout">
      <section className="pot-create-form-section" aria-labelledby="create-form-title">
        <div className="pot-create-intro">
          <p className="pot-eyebrow">POT SETUP</p>
          <h1 id="create-form-title">Set the rules before you share.</h1>
          <p>
            Choose how this pot settles and check the rules together. This prototype can preview
            your setup, but it cannot create a pot yet.
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
              {Array.from(draft.purpose).length.toLocaleString()} / 2,000 characters. Kept in this
              browser with your local draft.
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
              In the configured settlement token. Token and precision are not set up yet.
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
          Onchain creation is not available yet. Saving here does not create a pot or request a
          wallet transaction.
        </p>
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
                    <dd>{draft.target} · token not configured</dd>
                  </div>
                  <div>
                    <dt>Deadline</dt>
                    <dd>{formatDeadline(draft.deadline)}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Minimum contribution</dt>
                <dd>{draft.minimum} · token not configured</dd>
              </div>
            </dl>
            <p className="pot-create-preview-note">
              Local preview only. The settlement token and its precision are not configured, and
              nothing has been saved.
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
