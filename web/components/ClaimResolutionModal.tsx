"use client";

import { useState } from "react";

export type ClaimOutcome =
  | "Approved"
  | "Rejected"
  | "PartiallyCovered"
  | "RepairCompleted"
  | "Replaced";

export const RESOLUTION_OUTCOMES: ReadonlyArray<{
  value: ClaimOutcome;
  label: string;
  description: string;
}> = [
  {
    value: "Approved",
    label: "Approved",
    description: "Full warranty coverage approved for service.",
  },
  {
    value: "Rejected",
    label: "Rejected",
    description: "Claim denied (out of warranty, tampering, or excluded damage).",
  },
  {
    value: "PartiallyCovered",
    label: "PartiallyCovered",
    description: "Partial warranty coverage approved; customer responsible for balance.",
  },
  {
    value: "RepairCompleted",
    label: "RepairCompleted",
    description: "Authorized repair completed and unit returned to service.",
  },
  {
    value: "Replaced",
    label: "Replaced",
    description: "Unit replaced under warranty (retires original unit on-chain).",
  },
];

export interface ServiceClaimItem {
  claimId: number;
  unitId: string;
  brandDomain: string;
  serialNumber?: string;
  customerEmail?: string;
  warrantyValid?: boolean;
  filedDate: string;
  outcome: "Pending" | ClaimOutcome | "Repaired";
  reportHash: string;
}

export interface ClaimResolutionPayload {
  claimId: number;
  unitId: string;
  outcome: ClaimOutcome;
  technicianNotes: string;
  replacementPartSerials: string[];
}

export function parseReplacementSerials(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildDiagnosticReportText(payload: ClaimResolutionPayload): string {
  const lines = [
    `Veritag Authorized Service Diagnostic Report`,
    `Claim ID: #${payload.claimId}`,
    `Unit ID: ${payload.unitId}`,
    `Outcome: ${payload.outcome}`,
    `Technician Notes: ${payload.technicianNotes.trim() || "No additional notes provided."}`,
  ];
  if (payload.replacementPartSerials.length > 0) {
    lines.push(`Replacement Part Serials: ${payload.replacementPartSerials.join(", ")}`);
  }
  return lines.join("\n");
}

export interface ClaimResolutionModalProps {
  claim: ServiceClaimItem;
  isSubmitting?: boolean;
  onClose: () => void;
  onResolve: (payload: ClaimResolutionPayload) => Promise<void> | void;
}

export function ClaimResolutionModal({
  claim,
  isSubmitting = false,
  onClose,
  onResolve,
}: ClaimResolutionModalProps) {
  const [outcome, setOutcome] = useState<ClaimOutcome>("Approved");
  const [technicianNotes, setTechnicianNotes] = useState("");
  const [replacementSerialsInput, setReplacementSerialsInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!technicianNotes.trim()) {
      setValidationError("Technician diagnosis notes are required before resolving a claim.");
      return;
    }
    setValidationError(null);
    await onResolve({
      claimId: claim.claimId,
      unitId: claim.unitId,
      outcome,
      technicianNotes: technicianNotes.trim(),
      replacementPartSerials: parseReplacementSerials(replacementSerialsInput),
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-resolution-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              Claim #{claim.claimId} · {claim.brandDomain}
            </span>
            <h2 id="claim-resolution-title" className="mt-1 text-lg font-bold text-slate-900">
              Inspect &amp; Resolve Warranty Claim
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-600">On-Chain Warranty Status</span>
            <span
              className={`rounded-full px-2.5 py-0.5 font-semibold ${
                claim.warrantyValid === false
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {claim.warrantyValid === false ? "Expired / Invalid" : "Verified Active"}
            </span>
          </div>
          <p className="break-all font-mono text-slate-600">Unit: {claim.unitId}</p>
          {claim.serialNumber && (
            <p className="text-slate-600">Serial: {claim.serialNumber}</p>
          )}
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label
              htmlFor="claim-outcome-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Resolution Outcome
            </label>
            <select
              id="claim-outcome-select"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as ClaimOutcome)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              {RESOLUTION_OUTCOMES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {RESOLUTION_OUTCOMES.find((opt) => opt.value === outcome)?.description}
            </p>
          </div>

          <div>
            <label
              htmlFor="technician-notes"
              className="block text-xs font-semibold text-slate-700"
            >
              Technician Assessment &amp; Diagnosis Notes
            </label>
            <textarea
              id="technician-notes"
              rows={4}
              value={technicianNotes}
              onChange={(e) => setTechnicianNotes(e.target.value)}
              placeholder="Document inspection findings, root cause, and warranty verification details..."
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="replacement-part-serials"
              className="block text-xs font-semibold text-slate-700"
            >
              Replacement Part Serial Numbers (optional, comma or newline separated)
            </label>
            <textarea
              id="replacement-part-serials"
              rows={2}
              value={replacementSerialsInput}
              onChange={(e) => setReplacementSerialsInput(e.target.value)}
              placeholder="e.g. PART-MVT-9912, PART-SEAL-4401"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
            />
          </div>

          {validationError && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {validationError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isSubmitting ? "Signing resolve_claim..." : "Sign & Execute resolve_claim"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
