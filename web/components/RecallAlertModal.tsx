"use client";

import { useEffect, useState } from "react";

export type RecallSeverity = "Class I" | "Class II" | "Class III";

export interface RecallAlertModalProps {
  brandDomain?: string | null;
  batchId?: string;
  serial?: string;
  reasonCode?: string;
  severity?: RecallSeverity;
  officialNotice?: string;
  supportHref?: string;
  hotline?: string;
  onFileReturn?: () => void;
}

const SEVERITY_BADGE_CLASSES: Record<RecallSeverity, string> = {
  "Class I": "bg-red-700 text-white border-red-800",
  "Class II": "bg-orange-600 text-white border-orange-700",
  "Class III": "bg-amber-500 text-slate-950 border-amber-600",
};

function playRecallWarningTone(): void {
  if (typeof window === "undefined") return;
  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignore audio playback errors when autoplay is blocked or unsupported
  }
}

export function RecallAlertModal({
  brandDomain,
  batchId,
  serial,
  reasonCode = "BATCH-RECALL-001",
  severity = "Class I",
  officialNotice = "Stop using this product immediately. This production batch has been recalled on-chain by the manufacturer due to a verified safety or quality hazard. Do not transfer, resell, or attempt warranty activation.",
  supportHref = "#recall-support",
  hotline = "+1-800-555-0199",
  onFileReturn,
}: RecallAlertModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    playRecallWarningTone();
  }, []);

  if (acknowledged) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recall-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl border-2 border-red-600 bg-white p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-800">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-ping" />
            Urgent Safety Recall
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${SEVERITY_BADGE_CLASSES[severity]}`}
          >
            {severity}
          </span>
        </div>

        <h2
          id="recall-modal-title"
          className="mt-4 text-xl font-bold tracking-tight text-red-950 sm:text-2xl"
        >
          Official Product Recall Notice
        </h2>

        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-950 space-y-1">
          <div>
            <span className="font-semibold">Recall Reason Code:</span>{" "}
            <span className="font-mono font-bold">{reasonCode}</span>
          </div>
          {brandDomain && (
            <div>
              <span className="font-semibold">Issuer:</span> {brandDomain}
            </div>
          )}
          {batchId && (
            <div className="truncate">
              <span className="font-semibold">Batch ID:</span>{" "}
              <span className="font-mono">{batchId}</span>
            </div>
          )}
          {serial && (
            <div>
              <span className="font-semibold">Serial:</span>{" "}
              <span className="font-mono">{serial}</span>
            </div>
          )}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-700">{officialNotice}</p>

        <div className="mt-4 rounded-xl bg-slate-100 p-3 text-xs text-slate-700">
          <span className="font-semibold text-slate-900">Safety Hotline:</span>{" "}
          <span className="font-mono font-semibold">{hotline}</span>
          <p className="mt-1">
            All warranty activation and ownership transfer actions are permanently disabled for
            recalled units.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {onFileReturn ? (
            <button
              type="button"
              onClick={onFileReturn}
              className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 sm:w-auto"
            >
              File Recall Return / Contact Support
            </button>
          ) : (
            <a
              href={supportHref}
              className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 sm:w-auto"
            >
              File Recall Return / Contact Support
            </a>
          )}
          <button
            type="button"
            onClick={() => setAcknowledged(true)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Acknowledge &amp; View Details
          </button>
        </div>
      </div>
    </div>
  );
}
