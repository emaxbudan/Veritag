"use client";

import { useEffect, useRef, useState } from "react";

interface TransferCountdownCardProps {
  transferCode: string;
  /** Unix timestamp (seconds) when the offer expires. Defaults to 24 h from mount if omitted. */
  expiresAt?: number;
  /** QR data URL for the share sheet. If omitted the Share QR button is hidden. */
  shareQrDataUrl?: string;
  onExpired?: () => void;
}

const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const WARNING_SECONDS = 15 * 60; // 15 minutes

function formatCountdown(secs: number): string {
  if (secs <= 0) return "00:00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function TransferCountdownCard({
  transferCode,
  expiresAt,
  shareQrDataUrl,
  onExpired,
}: TransferCountdownCardProps) {
  const totalDuration = useRef<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Initialise once
  useEffect(() => {
    const expiry = expiresAt ?? Math.floor(Date.now() / 1000) + 86_400;
    const initial = Math.max(0, expiry - Math.floor(Date.now() / 1000));
    totalDuration.current = initial;
    setSecondsLeft(initial);

    const id = setInterval(() => {
      const remaining = Math.max(0, expiry - Math.floor(Date.now() / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(id);
        onExpired?.();
      }
    }, 1_000);

    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  const fraction =
    totalDuration.current > 0 ? secondsLeft / totalDuration.current : 0;
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - fraction);
  const isWarning = secondsLeft > 0 && secondsLeft <= WARNING_SECONDS;
  const isExpired = secondsLeft === 0;

  const ringColor = isExpired
    ? "#94a3b8" // slate-400
    : isWarning
      ? "#f59e0b" // amber-500
      : "#10b981"; // emerald-500

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(transferCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_500);
    } catch {
      // Clipboard unavailable — silently ignore
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/owner?redeem=${encodeURIComponent(transferCode)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2_500);
    } catch {
      // Clipboard unavailable — silently ignore
    }
  }

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm space-y-4 ${
        isExpired
          ? "border-slate-300 bg-slate-100"
          : isWarning
            ? "border-amber-300 bg-amber-50"
            : "border-emerald-200 bg-slate-900 text-white"
      }`}
    >
      {/* Header */}
      <div className="text-xs font-semibold uppercase tracking-wider opacity-70">
        {isExpired ? "Transfer Code Expired" : "One-Time Resale Transfer Code"}
      </div>

      {/* Ring + countdown */}
      <div className="flex items-center gap-5">
        <svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
          className="shrink-0"
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="opacity-10"
          />
          {/* Progress arc */}
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 50 50)"
            style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s ease" }}
          />
          {/* Time label */}
          <text
            x="50"
            y="54"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="13"
            fontWeight="bold"
            fontFamily="ui-monospace, monospace"
            fill={isExpired ? "#94a3b8" : isWarning ? "#92400e" : "white"}
          >
            {formatCountdown(secondsLeft)}
          </text>
        </svg>

        {/* Code display */}
        <div className="min-w-0 flex-1 space-y-1">
          <div
            className={`font-mono text-xl font-bold tracking-widest break-all ${
              isExpired ? "text-slate-400 line-through" : isWarning ? "text-amber-900" : "text-emerald-400"
            }`}
          >
            {transferCode}
          </div>
          {!isExpired && (
            <div
              className={`text-xs font-medium ${isWarning ? "text-amber-700" : "text-slate-400"}`}
            >
              {isWarning
                ? "⚠ Less than 15 minutes remaining — share now!"
                : "Valid for one redemption · expires in " + formatCountdown(secondsLeft)}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!isExpired && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCopyCode()}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              copied
                ? "bg-emerald-500 text-white"
                : isWarning
                  ? "border border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
                  : "border border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
            }`}
          >
            {copied ? "✓ Copied!" : "Copy Transfer Code"}
          </button>

          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              copiedLink
                ? "bg-emerald-500 text-white"
                : isWarning
                  ? "border border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
                  : "border border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
            }`}
          >
            {copiedLink ? "✓ Link Copied!" : "Share Link"}
          </button>

          {shareQrDataUrl && (
            <a
              href={shareQrDataUrl}
              download={`veritag-transfer-${transferCode}.svg`}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                isWarning
                  ? "border border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
                  : "border border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
              }`}
            >
              Share QR Code
            </a>
          )}
        </div>
      )}
    </div>
  );
}
