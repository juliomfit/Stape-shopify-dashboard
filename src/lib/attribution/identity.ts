/**
 * Deterministic identity evidence for the Order Attribution Debugger.
 * Never expose plaintext email. Hashed email is presence-only in the UI.
 */

export type IdentityFieldStatus = "matched" | "present" | "missing" | "not_applicable";

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

function field(
  key: string,
  label: string,
  value: string | null | undefined,
  status?: IdentityFieldStatus,
): IdentityField {
  const ok = present(value);
  return {
    key,
    label,
    status: status ?? (ok ? "present" : "missing"),
    display: ok ? truncate(value) : null,
  };
}

/**
 * High: Shopify customer or gn_uid plus transaction id.
 * Partial: stape_user_id or hashed email or person key that is not just client_id.
 * Low: transaction only / anonymous client_id.
 */
export function identityEvidence(signals: IdentitySignals): IdentityEvidence {
  const gn = present(signals.gnUid);
  const stape = present(signals.stapeUserId);
  const customer = present(signals.shopifyCustomerId);
  const hashed = signals.hashedEmailPresent === true;
  const txn = present(signals.transactionId);
  const person = present(signals.personKey);
  const personLooksAnonymous =
    !person ||
    signals.personKey === signals.clientId ||
    Boolean(signals.personKey?.startsWith("cid:"));

  const fields: IdentityField[] = [
    field("gn_uid", "gn_uid", signals.gnUid, gn ? "matched" : "missing"),
    field("stape_user_id", "stape_user_id", signals.stapeUserId, stape ? "matched" : "missing"),
    field(
      "shopify_customer_id",
      "Shopify customer ID",
      signals.shopifyCustomerId,
      customer ? "matched" : "missing",
    ),
    {
      key: "hashed_email",
      label: "Hashed email",
      status: hashed ? "present" : signals.hashedEmailPresent === null ? "not_applicable" : "missing",
      display: hashed ? "present" : null,
    },
    field("transaction_id", "Transaction ID", signals.transactionId, txn ? "present" : "missing"),
    field("person_key", "Person key", signals.personKey, person ? "matched" : "missing"),
  ];

  let confidence: IdentityConfidence = "low";
  if ((customer || gn) && txn) {
    confidence = "high";
  } else if (customer || gn || (stape && txn) || (hashed && txn) || (person && !personLooksAnonymous)) {
    confidence = "partial";
  }

  const summary =
    confidence === "high"
      ? "High — deterministic customer or gn_uid stitch plus transaction id."
      : confidence === "partial"
        ? "Partial — some first-party identifiers matched; not a full customer stitch."
        : "Low — anonymous or transaction-only. Missing identifiers stay missing; this is not Direct.";

  return {
    personKey: signals.personKey ?? null,
    fields,
    confidence,
    summary,
  };
}
