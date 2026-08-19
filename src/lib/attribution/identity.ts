/**
 * Deterministic identity evidence for the Order Attribution Debugger.
 * Never expose plaintext email. Hashed email is presence-only in the UI.
 *
 * Statuses:
 *   PRESENT        — identifier exists on this order
 *   STITCHED       — evidence this identifier connected separate records
 *                    (it won the person_key)
 *   CORROBORATED   — present and consistent with the stitch, but did not win
 *   MISSING
 *   NOT APPLICABLE
 *
 * Presence alone is never called "matched" or "stitched".
 */

export type IdentityFieldStatus =
  | "PRESENT"
  | "STITCHED"
  | "CORROBORATED"
  | "MISSING"
  | "NOT APPLICABLE";

export type IdentityField = {
  key: string;
  label: string;
  status: IdentityFieldStatus;
  /** Safe display value (truncated / hashed). Never raw PII. */
  display: string | null;
};

export type IdentityConfidence = "high" | "partial" | "low";

export type IdentityEvidence = {
  personKey: string | null;
  fields: IdentityField[];
  confidence: IdentityConfidence;
  summary: string;
};

export type IdentitySignals = {
  personKey?: string | null;
  gnUid?: string | null;
  stapeUserId?: string | null;
  shopifyCustomerId?: string | null;
  hashedEmailPresent?: boolean | null;
  transactionId?: string | null;
  clientId?: string | null;
};

function present(value: string | null | undefined) {
  return Boolean(value && value.trim() && value.trim() !== "null");
}

function truncate(value: string | null | undefined, keep = 6) {
  if (!present(value) || !value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length <= keep + 2) {
    return trimmed;
  }
  return `${trimmed.slice(0, keep)}…`;
}

function personPrefix(personKey: string | null | undefined) {
  if (!present(personKey) || !personKey) {
    return null;
  }
  const idx = personKey.indexOf(":");
  return idx > 0 ? personKey.slice(0, idx) : null;
}

function statusForWinner(
  hasValue: boolean,
  won: boolean,
  anyStitch: boolean,
): IdentityFieldStatus {
  if (!hasValue) {
    return "MISSING";
  }
  if (won) {
    return "STITCHED";
  }
  if (anyStitch) {
    return "CORROBORATED";
  }
  return "PRESENT";
}

/**
 * High: Shopify customer or gn_uid actually won the person key plus transaction id.
 * Partial: a first-party identifier is present but did not necessarily stitch sessions.
 * Low: anonymous client_id / transaction only.
 */
export function identityEvidence(signals: IdentitySignals): IdentityEvidence {
  const gn = present(signals.gnUid);
  const stape = present(signals.stapeUserId);
  const customer = present(signals.shopifyCustomerId);
  const hashed = signals.hashedEmailPresent === true;
  const txn = present(signals.transactionId);
  const person = present(signals.personKey);
  const prefix = personPrefix(signals.personKey);
  const stitched = prefix != null && prefix !== "cid";
  const personLooksAnonymous = !person || prefix === "cid";

  const fields: IdentityField[] = [
    {
      key: "gn_uid",
      label: "gn_uid",
      status: statusForWinner(gn, prefix === "gn", stitched),
      display: gn ? truncate(signals.gnUid) : null,
    },
    {
      key: "stape_user_id",
      label: "stape_user_id",
      status: statusForWinner(stape, prefix === "stape", stitched),
      display: stape ? truncate(signals.stapeUserId) : null,
    },
    {
      key: "shopify_customer_id",
      label: "Shopify customer ID",
      status: statusForWinner(customer, prefix === "cust", stitched),
      display: customer ? truncate(signals.shopifyCustomerId) : null,
    },
    {
      key: "hashed_email",
      label: "Hashed email",
      status:
        signals.hashedEmailPresent === null
          ? "NOT APPLICABLE"
          : statusForWinner(hashed, prefix === "email", stitched),
      display: hashed ? "present" : null,
    },
    {
      key: "transaction_id",
      label: "Transaction ID",
      status: txn ? "PRESENT" : "MISSING",
      display: txn ? truncate(signals.transactionId) : null,
    },
    {
      key: "person_key",
      label: "Person key",
      status: !person ? "MISSING" : stitched ? "STITCHED" : "PRESENT",
      display: person ? truncate(signals.personKey) : null,
    },
  ];

  let confidence: IdentityConfidence = "low";
  if ((prefix === "cust" || prefix === "gn" || customer) && txn) {
    confidence = "high";
  } else if (
    stitched ||
    ((customer || gn || stape || hashed) && txn) ||
    (person && !personLooksAnonymous)
  ) {
    confidence = "partial";
  }

  const summary =
    confidence === "high"
      ? "High — person_key was stitched from Shopify customer or gn_uid plus a transaction id."
      : confidence === "partial"
        ? "Partial — identifiers are present; only STITCHED fields actually connected records."
        : personLooksAnonymous
          ? "Low — anonymous or transaction-only. Presence is not a stitch. Missing stays missing; this is not Direct."
          : "Low — no evidence this identifier connected separate records.";

  return {
    personKey: signals.personKey ?? null,
    fields,
    confidence,
    summary,
  };
}
