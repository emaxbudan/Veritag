import { scValToNative, xdr } from "@stellar/stellar-sdk";

export interface RawSorobanEvent {
  id: string;
  ledger: number;
  txHash: string;
  contractId?: string;
  ledgerClosedAt?: string;
  topic: ReadonlyArray<xdr.ScVal | string>;
  value: xdr.ScVal | string;
}

export type ContractKind = "registry" | "account_factory" | "passkey_account";

export type DecodedRegistryEvent =
  | {
      type: "brand_registered";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      brand: string;
      domain: string;
    }
  | {
      type: "brand_verified";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      brand: string;
    }
  | {
      type: "service_center_registered";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      brand: string;
      serviceCenter: string;
      authorized: boolean;
    }
  | {
      type: "batch_committed";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      brand: string;
      batchId: string;
      root: string;
      warrantyMonths: number;
      unitCount: number;
    }
  | {
      type: "unit_activated";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      unitId: string;
      brand: string;
      batchId: string;
      owner: string;
      warrantyExpiry: number;
    }
  | {
      type: "duplicate_attempt";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      unitId: string;
      caller: string;
    }
  | {
      type: "transfer_offered";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      unitId: string;
      codeHash: string;
      expiresAt: number;
    }
  | {
      type: "transfer_cancelled";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      unitId: string;
    }
  | {
      type: "unit_transferred";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      unitId: string;
      from: string;
      to: string;
    }
  | {
      type: "claim_filed";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      unitId: string;
      claimId: number;
      serviceCenter: string;
    }
  | {
      type: "claim_resolved";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      unitId: string;
      claimId: number;
      outcome: "Pending" | "Approved" | "Rejected" | "Repaired" | "Replaced";
      reportHash: string;
    }
  | {
      type: "unit_flagged";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      unitId: string;
      reasonHash: string;
    }
  | {
      type: "batch_recalled";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      brand: string;
      batchId: string;
      reasonHash: string;
    };

function toScVal(item: xdr.ScVal | string): xdr.ScVal {
  return typeof item === "string" ? xdr.ScVal.fromXDR(item, "base64") : item;
}

function asHex(val: unknown): string {
  if (val instanceof Uint8Array || Buffer.isBuffer(val)) {
    return Buffer.from(val).toString("hex");
  }
  if (typeof val === "string") {
    return val;
  }
  throw new Error(`Expected byte buffer or hex string, got ${typeof val}`);
}

function asNumber(val: unknown): number {
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "number") return val;
  if (typeof val === "string") return Number(val);
  throw new Error(`Expected numeric value, got ${typeof val}`);
}

const CLAIM_OUTCOMES: ReadonlyArray<"Pending" | "Approved" | "Rejected" | "Repaired" | "Replaced"> = [
  "Pending",
  "Approved",
  "Rejected",
  "Repaired",
  "Replaced",
];

function decodeOutcome(
  raw: unknown,
): "Pending" | "Approved" | "Rejected" | "Repaired" | "Replaced" {
  if (typeof raw === "number" || typeof raw === "bigint") {
    return CLAIM_OUTCOMES[Number(raw)] ?? "Pending";
  }
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    const tag = raw[0] as "Pending" | "Approved" | "Rejected" | "Repaired" | "Replaced";
    if (CLAIM_OUTCOMES.includes(tag)) return tag;
  }
  if (typeof raw === "string" && (CLAIM_OUTCOMES as readonly string[]).includes(raw)) {
    return raw as "Pending" | "Approved" | "Rejected" | "Repaired" | "Replaced";
  }
  return "Pending";
}

export function decodeRegistryEvent(raw: RawSorobanEvent): DecodedRegistryEvent | null {
  if (raw.topic.length === 0) return null;

  const topicsNative = raw.topic.map((t) => scValToNative(toScVal(t)) as unknown);
  const eventName = String(topicsNative[0] ?? "");
  const dataVal = scValToNative(toScVal(raw.value)) as Record<string, unknown> | null;
  const data = dataVal && typeof dataVal === "object" ? dataVal : {};
  const createdAt = raw.ledgerClosedAt ?? new Date().toISOString();
  const base = { id: raw.id, ledger: raw.ledger, txHash: raw.txHash, createdAt };

  switch (eventName) {
    case "brand_registered":
      return {
        ...base,
        type: "brand_registered",
        brand: String(topicsNative[1]),
        domain: String(data.domain ?? ""),
      };

    case "brand_verified":
      return {
        ...base,
        type: "brand_verified",
        brand: String(topicsNative[1]),
      };

    case "service_center_registered":
      return {
        ...base,
        type: "service_center_registered",
        brand: String(topicsNative[1]),
        serviceCenter: String(topicsNative[2]),
        authorized: Boolean(data.authorized),
      };

    case "batch_committed":
      return {
        ...base,
        type: "batch_committed",
        brand: String(topicsNative[1]),
        batchId: asHex(topicsNative[2]),
        root: asHex(data.root),
        warrantyMonths: asNumber(data.warranty_months),
        unitCount: asNumber(data.unit_count),
      };

    case "unit_activated":
      return {
        ...base,
        type: "unit_activated",
        unitId: asHex(topicsNative[1]),
        brand: String(data.brand),
        batchId: asHex(data.batch_id),
        owner: String(data.owner),
        warrantyExpiry: asNumber(data.warranty_expiry),
      };

    case "duplicate_attempt":
      return {
        ...base,
        type: "duplicate_attempt",
        unitId: asHex(topicsNative[1]),
        caller: String(data.caller),
      };

    case "transfer_offered":
      return {
        ...base,
        type: "transfer_offered",
        unitId: asHex(topicsNative[1]),
        codeHash: asHex(data.code_hash),
        expiresAt: asNumber(data.expires_at),
      };

    case "transfer_cancelled":
      return {
        ...base,
        type: "transfer_cancelled",
        unitId: asHex(topicsNative[1]),
      };

    case "unit_transferred":
      return {
        ...base,
        type: "unit_transferred",
        unitId: asHex(topicsNative[1]),
        from: String(data.from),
        to: String(data.to),
      };

    case "claim_filed":
      return {
        ...base,
        type: "claim_filed",
        unitId: asHex(topicsNative[1]),
        claimId: asNumber(data.claim_id),
        serviceCenter: String(data.service_center),
      };

    case "claim_resolved":
      return {
        ...base,
        type: "claim_resolved",
        unitId: asHex(topicsNative[1]),
        claimId: asNumber(data.claim_id),
        outcome: decodeOutcome(data.outcome),
        reportHash: asHex(data.report_hash),
      };

    case "unit_flagged":
      return {
        ...base,
        type: "unit_flagged",
        unitId: asHex(topicsNative[1]),
        reasonHash: asHex(data.reason_hash),
      };

    case "batch_recalled":
      return {
        ...base,
        type: "batch_recalled",
        brand: String(topicsNative[1]),
        batchId: asHex(topicsNative[2]),
        reasonHash: asHex(data.reason_hash),
      };

    default:
      return null;
  }
}

export type DecodedAccountFactoryEvent = {
  type: "account_deployed";
  id: string;
  ledger: number;
  txHash: string;
  createdAt: string;
  contractId?: string;
  account: string;
  salt?: string;
  credentialId?: string;
};

export type DecodedPasskeyAccountEvent =
  | {
      type: "passkey_added";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      contractId?: string;
      account: string;
      credentialId: string;
    }
  | {
      type: "passkey_removed";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      contractId?: string;
      account: string;
      credentialId: string;
    }
  | {
      type: "passkey_rotated";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      contractId?: string;
      account: string;
      oldCredentialId?: string;
      newCredentialId: string;
    }
  | {
      type: "recovery_updated";
      id: string;
      ledger: number;
      txHash: string;
      createdAt: string;
      contractId?: string;
      account: string;
      recovery: string;
    };

export type DecodedEvent =
  | DecodedRegistryEvent
  | DecodedAccountFactoryEvent
  | DecodedPasskeyAccountEvent;

function parseEventParts(raw: RawSorobanEvent) {
  if (raw.topic.length === 0) return null;
  const topicsNative = raw.topic.map((t) => scValToNative(toScVal(t)) as unknown);
  const eventName = String(topicsNative[0] ?? "");
  const dataVal = scValToNative(toScVal(raw.value)) as Record<string, unknown> | null;
  const data = dataVal && typeof dataVal === "object" ? dataVal : {};
  const createdAt = raw.ledgerClosedAt ?? new Date().toISOString();
  const base = {
    id: raw.id,
    ledger: raw.ledger,
    txHash: raw.txHash,
    createdAt,
    ...(raw.contractId ? { contractId: raw.contractId } : {}),
  };
  return { topicsNative, eventName, data, base };
}

export function decodeAccountFactoryEvent(
  raw: RawSorobanEvent,
): DecodedAccountFactoryEvent | null {
  const parts = parseEventParts(raw);
  if (!parts) return null;
  const { topicsNative, eventName, data, base } = parts;

  if (eventName === "account_deployed" || eventName === "AccountDeployed") {
    const account = String(data.account ?? topicsNative[1] ?? "");
    if (!account) return null;
    return {
      ...base,
      type: "account_deployed",
      account,
      ...(data.salt !== undefined ? { salt: asHex(data.salt) } : {}),
      ...(data.credential_id !== undefined ? { credentialId: asHex(data.credential_id) } : {}),
    };
  }
  return null;
}

export function decodePasskeyAccountEvent(
  raw: RawSorobanEvent,
): DecodedPasskeyAccountEvent | null {
  const parts = parseEventParts(raw);
  if (!parts) return null;
  const { topicsNative, eventName, data, base } = parts;
  const account = String(data.account ?? raw.contractId ?? "");

  switch (eventName) {
    case "passkey_added":
    case "PasskeyAdded":
      return {
        ...base,
        type: "passkey_added",
        account,
        credentialId: asHex(data.credential_id ?? topicsNative[1]),
      };
    case "passkey_removed":
    case "PasskeyRemoved":
      return {
        ...base,
        type: "passkey_removed",
        account,
        credentialId: asHex(data.credential_id ?? topicsNative[1]),
      };
    case "passkey_rotated":
    case "PasskeyRotated":
      return {
        ...base,
        type: "passkey_rotated",
        account,
        ...(data.old_credential_id !== undefined
          ? { oldCredentialId: asHex(data.old_credential_id) }
          : {}),
        newCredentialId: asHex(data.new_credential_id ?? data.credential_id ?? topicsNative[1]),
      };
    case "recovery_updated":
    case "RecoveryUpdated":
      return {
        ...base,
        type: "recovery_updated",
        account,
        recovery: String(data.recovery ?? topicsNative[1] ?? ""),
      };
    default:
      return null;
  }
}

/**
 * Dispatches a raw Soroban event to the appropriate contract decoder based on `raw.contractId`
 * and the configured contract kind registry.
 */
export function decodeContractEvent(
  raw: RawSorobanEvent,
  contractKinds?: ReadonlyMap<string, ContractKind>,
): DecodedEvent | null {
  const kind = raw.contractId ? contractKinds?.get(raw.contractId) : undefined;

  if (kind === "account_factory") {
    return decodeAccountFactoryEvent(raw);
  }
  if (kind === "passkey_account") {
    return decodePasskeyAccountEvent(raw);
  }
  if (kind === "registry") {
    return decodeRegistryEvent(raw);
  }

  return (
    decodeRegistryEvent(raw) ??
    decodeAccountFactoryEvent(raw) ??
    decodePasskeyAccountEvent(raw)
  );
}
