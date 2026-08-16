/**
 * Source rows come from the visit (utm_source, click id, referrer).
 * The dashboard does not keep an allowlist of sources that are allowed to appear.
 * EMAIL_SOURCES only helps classify channel = Email when medium is missing.
 */

export const EMAIL_MEDIUMS = [
  "email",
  "e-mail",
  "sms",
  "mms",
  "edm",
  "newsletter",
] as const;

export const EMAIL_SOURCES = [
  "sendvio",
  "klaviyo",
  "omnisend",
  "postscript",
  "attentive",
  "mailchimp",
  "brevo",
  "sendgrid",
  "drip",
  "listrak",
  "yotpo",
  "smsbump",
  "judgeme",
  "privy",
  "email",
  "sms",
] as const;

export const EMAIL_MEDIUM_SQL = EMAIL_MEDIUMS.join("|");
export const EMAIL_SOURCE_SQL = EMAIL_SOURCES.join("|");

export function normalizeSourceToken(value: string) {
  const trimmed = value.trim().replace(/\+/g, " ");
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }
  return decoded.trim().toLowerCase();
}

export function isEmailTraffic(source: string, medium: string) {
  const sourceToken = normalizeSourceToken(source);
  const mediumToken = normalizeSourceToken(medium);
  if (
    EMAIL_MEDIUMS.some(
      (item) => mediumToken === item || mediumToken.includes(item),
    )
  ) {
    return true;
  }
  return (EMAIL_SOURCES as readonly string[]).includes(sourceToken);
}

export function referrerHost(referrer: string) {
  const raw = referrer.trim();
  if (!raw) {
    return "";
  }
  try {
    const withProtocol = raw.includes("://") ? raw : `https://${raw}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return normalizeSourceToken(raw).replace(/^www\./, "");
  }
}

export type ObservedTouch = {
  uid?: string;
  ts?: string;
  landingPath?: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  fbclid: string;
  msclkid: string;
  ttclid: string;
};

function hasAnySignal(touch: ObservedTouch) {
  return [
    touch.uid,
    touch.ts,
    touch.landingPath,
    touch.referrer,
    touch.utmSource,
    touch.utmMedium,
    touch.utmCampaign,
    touch.utmContent,
    touch.utmTerm,
    touch.gclid,
    touch.gbraid,
    touch.wbraid,
    touch.fbclid,
    touch.msclkid,
    touch.ttclid,
  ].some((value) => Boolean(value && String(value).trim()));
}

/** Row label for a Triple Whale-style source table. Not a channel bucket. */
export function observedSource(touch: ObservedTouch) {
  if (!hasAnySignal(touch)) {
    return "Unknown";
  }
  if (touch.utmSource.trim()) {
    return normalizeSourceToken(touch.utmSource);
  }
  if (touch.gclid || touch.gbraid || touch.wbraid) {
    return "google";
  }
  if (touch.fbclid) {
    return "facebook";
  }
  if (touch.ttclid) {
    return "tiktok";
  }
  if (touch.msclkid) {
    return "microsoft";
  }
  const host = referrerHost(touch.referrer);
  if (host) {
    return host;
  }
  return "Direct";
}
