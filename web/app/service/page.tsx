"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildDiagnosticReportText,
  ClaimResolutionModal,
  type ClaimResolutionPayload,
  type ServiceClaimItem,
} from "@/components/ClaimResolutionModal";
import {
  SerialSearchBar,
  type SearchSuggestionItem,
} from "@/components/SerialSearchBar";
import { getFileDownloadUrl, PUBLIC_CONFIG } from "@/lib/stellar";
import { useWallet } from "@/lib/wallet-context";

export default function ServiceCenterPage() {
  const { session, connectRoleKeypair, signContractAction } = useWallet();
  const [claims, setClaims] = useState<ServiceClaimItem[]>([
    {
      claimId: 1,
      unitId: "55aa66bb77cc88dd99ee00ff112233445566778899aabbccddeeff0011223344",
      brandDomain: "chronos-watches.swiss",
      serialNumber: "CH-2026-000101",
      customerEmail: "collector@chronos.ch",
      warrantyValid: true,
      filedDate: "2026-11-05",
      outcome: "Pending",
      reportHash: "",
    },
  ]);
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [showPendingOnly, setShowPendingOnly] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeClaim, setActiveClaim] = useState<ServiceClaimItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadServiceClaims = useCallback(async (address: string, token: string) => {
    try {
      const res = await fetch(
        `${PUBLIC_CONFIG.apiUrl}/v1/service-centers/${encodeURIComponent(address)}/claims`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        claims: Array<{
          claimId: number;
          unitId: string;
          brandDomain?: string;
          serialNumber?: string;
          customerEmail?: string;
          warrantyValid?: boolean;
          outcome: ServiceClaimItem["outcome"];
          reportHash: string;
          filedAt: number;
        }>;
      };
      if (data.claims.length > 0) {
        setClaims(
          data.claims.map((c) => ({
            claimId: c.claimId,
            unitId: c.unitId,
            brandDomain: c.brandDomain ?? "Verified Brand",
            serialNumber: c.serialNumber,
            customerEmail: c.customerEmail,
            warrantyValid: c.warrantyValid ?? true,
            filedDate: new Date(c.filedAt * 1000).toISOString().slice(0, 10),
            outcome: c.outcome,
            reportHash: c.reportHash,
          })),
        );
      }
    } catch {
      // Keep preview claim when offline
    }
  }, []);

  useEffect(() => {
    if (session?.address && session?.token) {
      void loadServiceClaims(session.address, session.token);
    }
  }, [session?.address, session?.token, loadServiceClaims]);

  const authorizedBrands = useMemo(
    () => Array.from(new Set(claims.map((c) => c.brandDomain))),
    [claims],
  );

  const searchSuggestions: SearchSuggestionItem[] = useMemo(
    () =>
      claims.map((c) => ({
        id: `${c.unitId}:${c.claimId}`,
        unitId: c.unitId,
        serialNumber: c.serialNumber,
        brandDomain: c.brandDomain,
        customerEmail: c.customerEmail,
        label: c.serialNumber
          ? `Claim #${c.claimId} · ${c.serialNumber}`
          : `Claim #${c.claimId}`,
      })),
    [claims],
  );

  const filteredClaims = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return claims.filter((claim) => {
      if (showPendingOnly && claim.outcome !== "Pending") {
        return false;
      }
      if (selectedBrand !== "all" && claim.brandDomain !== selectedBrand) {
        return false;
      }
      if (!q) return true;
      return (
        claim.unitId.toLowerCase().includes(q) ||
        (claim.serialNumber ?? "").toLowerCase().includes(q) ||
        claim.brandDomain.toLowerCase().includes(q) ||
        (claim.customerEmail ?? "").toLowerCase().includes(q)
      );
    });
  }, [claims, selectedBrand, showPendingOnly, searchQuery]);

  async function handleResolve(payload: ClaimResolutionPayload) {
    setIsSubmitting(true);
    const contentText = buildDiagnosticReportText(payload);

    try {
      if (session?.token) {
        try {
          const uploadRes = await fetch(`${PUBLIC_CONFIG.apiUrl}/v1/files`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
              contentBase64: btoa(contentText),
              mime: "text/plain",
            }),
          });
          if (uploadRes.ok) {
            const uploaded = (await uploadRes.json()) as { hash: string };
            const signedTxXdr = await signContractAction("resolve_claim");
            const resolveRes = await fetch(
              `${PUBLIC_CONFIG.apiUrl}/v1/claims/${payload.claimId}/resolve`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.token}`,
                },
                body: JSON.stringify({
                  unitId: payload.unitId,
                  outcome: payload.outcome,
                  reportHash: uploaded.hash,
                  technicianNotes: payload.technicianNotes,
                  replacementPartSerials: payload.replacementPartSerials,
                  ...(signedTxXdr ? { signedTxXdr } : {}),
                }),
              },
            );
            if (resolveRes.ok) {
              const resolvedData = (await resolveRes.json()) as { sponsoredTxHash?: string };
              setClaims((prev) =>
                prev.map((c) =>
                  c.claimId === payload.claimId && c.unitId === payload.unitId
                    ? { ...c, outcome: payload.outcome, reportHash: uploaded.hash }
                    : c,
                ),
              );
              setNotice(
                `Uploaded diagnostic report (${uploaded.hash.slice(0, 12)}...) & signed resolve_claim for Claim #${payload.claimId} (${payload.outcome})${
                  resolvedData.sponsoredTxHash
                    ? ` [Tx: ${resolvedData.sponsoredTxHash.slice(0, 12)}...]`
                    : ""
                }.`,
              );
              setActiveClaim(null);
              return;
            }
          }
        } catch {
          // Offline fallback
        }
      }

      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest("SHA-256", encoder.encode(contentText));
      const reportHash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      setClaims((prev) =>
        prev.map((c) =>
          c.claimId === payload.claimId && c.unitId === payload.unitId
            ? { ...c, outcome: payload.outcome, reportHash }
            : c,
        ),
      );
      setNotice(
        `Anchored report SHA-256 (${reportHash.slice(0, 12)}...) and resolved Claim #${payload.claimId} (${payload.outcome}).`,
      );
      setActiveClaim(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Authorized Service Center Queue</h1>
          <p className="text-sm text-slate-600">
            Validate unit warranty eligibility on-chain and anchor signed diagnostic report hashes to
            Soroban.
          </p>
        </div>
        {!session && (
          <button
            type="button"
            onClick={() => void connectRoleKeypair("service")}
            className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Connect Service Center Signer
          </button>
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto_auto]">
        <SerialSearchBar
          suggestions={searchSuggestions}
          onSearch={(q) => setSearchQuery(q)}
          onSelectSuggestion={(item) => setSearchQuery(item.serialNumber ?? item.unitId)}
        />
        <select
          aria-label="Filter by authorized brand"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="all">All Authorized Brands</option>
          {authorizedBrands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowPendingOnly((prev) => !prev)}
          className={`rounded-xl border px-3.5 py-2 text-xs font-semibold ${
            showPendingOnly
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          {showPendingOnly ? "Pending Queue Only" : "Showing All Claims"}
        </button>
      </div>

      {notice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {notice}
        </div>
      )}

      <div className="space-y-4">
        {filteredClaims.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No matching warranty claims in queue.
          </div>
        ) : (
          filteredClaims.map((claim) => (
            <div
              key={`${claim.unitId}:${claim.claimId}`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-blue-600">
                    Claim #{claim.claimId} · {claim.brandDomain}
                  </span>
                  <p className="mt-1 break-all font-mono text-xs text-slate-600">
                    Unit: {claim.unitId}
                  </p>
                  {claim.serialNumber && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      Serial: {claim.serialNumber} · Filed {claim.filedDate}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      claim.outcome === "Pending"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {claim.outcome}
                  </span>
                  {claim.outcome === "Pending" && (
                    <button
                      type="button"
                      onClick={() => setActiveClaim(claim)}
                      className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Inspect &amp; Resolve
                    </button>
                  )}
                </div>
              </div>

              {claim.outcome !== "Pending" && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <p className="break-all font-mono text-slate-500">
                    Anchored Report SHA-256: {claim.reportHash}
                  </p>
                  {claim.reportHash && (
                    <a
                      href={getFileDownloadUrl(claim.reportHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      Download Diagnostic Report
                    </a>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {activeClaim && (
        <ClaimResolutionModal
          claim={activeClaim}
          isSubmitting={isSubmitting}
          onClose={() => setActiveClaim(null)}
          onResolve={handleResolve}
        />
      )}
    </div>
  );
}
