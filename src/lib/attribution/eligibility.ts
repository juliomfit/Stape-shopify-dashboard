/**
 * Canonical touch eligibility — TypeScript reference for attribution_policy_v1.
 *
 * Three mutually exclusive concepts:
 *   1. REAL DIRECT     — storefront session, no external referrer, no paid click
 *                        id, no attributable source. Eligible for First / Last /
 *                        Linear / Position / Time Decay. Last Non-Direct skips it
 *                        when a prior non-direct touch exists.
 *   2. INTERNAL NOISE  — checkout, web-pixels@, payment-processor, and own-domain
 *                        self-referrals that are not a new acquisition. NOT Direct.
 *                        Excluded from attribution touchpoints.
 *   3. UNKNOWN         — no reliable eligible touch. NEVER coerced to Direct.
 *
 * A canonical marketing touch is ONE session-level acquisition, not every event
 * row (page_view, add_to_cart, begin_checkout, purchase, …).
 *
 * BigQuery must implement the same predicates via
 * `src/lib/stape/channel-sql.ts` (`INTERNAL_NOISE_SQL`, `CHANNEL_SQL`).
 */

import { isEmailTraffic, referrerHost } from "../tracking/observed-source.ts";
import { DIRECT_CHANNEL, UNKNOWN_CHANNEL, PAID_POLICY_CHANNELS } from "./policy.ts";

export const PAYMENT_PROCESSOR_HOST_FRAGMENTS = [
  "checkout.shopify.com",
  "shopifycs.com",
  "pay.shopify.com",
  "shop.app",
  "paypal.com",
  "paypal.me",
  "stripe.com",
  "klarna.com",
  "afterpay.com",
] as const;

export type EligibilityEvent = {
  sessionKey: string;
  timestamp: number;
  eventName?: string | null;
  pageLocation?: string | null;
  pageReferrer?: string | null;
  pagePath?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  dclid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
  msclkid?: string | null;
};

export type SessionTouch = {
  id: string;
  sessionKey: string;
  timestamp: number;
  channel: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landingPage: string | null;
  clickId: string | null;
  clickIdType: string | null;
  isPaid: boolean;
  isDirect: boolean;
  isInternalNoise: false;
  isTouchEligible: true;
};

function present(value: string | null | undefined): value is string {
  return Boolean(value && value.trim() && value.trim().toLowerCase() !== "null");
}

function lower(value: string | null | undefined) {
  return present(value) ? value.trim().toLowerCase() : "";
}

function stripWww(host: string) {
  return host.replace(/^www\./, "").toLowerCase();
}

function pageHost(location: string | null | undefined) {
  return stripWww(referrerHost(location ?? ""));
}

function pathOf(event: EligibilityEvent) {
  if (present(event.pagePath)) {
    return event.pagePath.toLowerCase();
  }
  const location = event.pageLocation ?? "";
  try {
    const withProtocol = location.includes("://") ? location : `https://${location}`;
    return new URL(withProtocol).pathname.toLowerCase();
  } catch {
    const match = location.match(/https?:\/\/[^/]+(\/[^?]*)/i);
    return (match?.[1] ?? location).toLowerCase();
  }
}

function hasPaidClickId(event: EligibilityEvent) {
  return (
    present(event.gclid) ||
    present(event.gbraid) ||
    present(event.wbraid) ||
    present(event.dclid) ||
    present(event.fbclid) ||
    present(event.ttclid) ||
    present(event.msclkid) ||
    /[?&](gclid|gbraid|wbraid|dclid|fbclid|ttclid|msclkid)=/i.test(
      event.pageLocation ?? "",
    )
  );
}

function hasUtmSource(event: EligibilityEvent) {
  return (
    present(event.utmSource) ||
    /[?&]utm_source=[^&]+/i.test(event.pageLocation ?? "")
  );
}

function utmSourceOf(event: EligibilityEvent) {
  if (present(event.utmSource)) {
    return lower(event.utmSource);
  }
  const match = (event.pageLocation ?? "").match(/[?&]utm_source=([^&#]+)/i);
  return match ? decodeURIComponent(match[1].replace(/\+/g, " ")).toLowerCase() : "";
}

function utmMediumOf(event: EligibilityEvent) {
  if (present(event.utmMedium)) {
    return lower(event.utmMedium);
  }
  const match = (event.pageLocation ?? "").match(/[?&]utm_medium=([^&#]+)/i);
  return match ? decodeURIComponent(match[1].replace(/\+/g, " ")).toLowerCase() : "";
}

function hostsRelated(a: string, b: string) {
  if (!a || !b) {
    return false;
  }
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function isCheckoutOrPixelPath(event: EligibilityEvent) {
  const location = lower(event.pageLocation);
  const path = pathOf(event);
  return (
    location.includes("web-pixels@") ||
    location.includes("/checkouts/") ||
    location.includes("/checkout") ||
    /^\/checkouts?(\/|$)/.test(path)
  );
}

function isPaymentProcessorReferrer(event: EligibilityEvent) {
  const host = stripWww(referrerHost(event.pageReferrer ?? ""));
  if (!host) {
    return false;
  }
  return PAYMENT_PROCESSOR_HOST_FRAGMENTS.some(
    (fragment) => host === fragment || host.endsWith(`.${fragment}`),
  );
}

function isOwnDomainSelfReferral(event: EligibilityEvent) {
  const landing = pageHost(event.pageLocation);
  const referrer = stripWww(referrerHost(event.pageReferrer ?? ""));
  if (!landing || !referrer) {
    return false;
  }
  if (!hostsRelated(landing, referrer)) {
    return false;
  }
  return !hasPaidClickId(event) && !hasUtmSource(event);
}

/** Internal / checkout noise. Not Direct. Not an attribution touch. */
export function isInternalNoise(event: EligibilityEvent): boolean {
  return (
    isCheckoutOrPixelPath(event) ||
    isPaymentProcessorReferrer(event) ||
    isOwnDomainSelfReferral(event)
  );
}

/**
 * Channel for a single event AFTER internal-noise exclusion.
 * Checkout/self-referral must never return Direct.
 */
export function classifyEligibleChannel(event: EligibilityEvent): string {
  const location = event.pageLocation ?? "";
  const referrer = lower(event.pageReferrer);
  const source = utmSourceOf(event);
  const medium = utmMediumOf(event);

  if (
    present(event.gclid) ||
    present(event.gbraid) ||
    present(event.wbraid) ||
    present(event.dclid) ||
    /[?&](gclid|gbraid|wbraid|dclid)=/i.test(location) ||
    (source === "google" &&
      /^(cpc|ppc|paid|paidsearch|paid_search)$/.test(medium))
  ) {
    return "Google Ads";
  }
  if (
    present(event.fbclid) ||
    /[?&]fbclid=/i.test(location) ||
    (/^(facebook|fb|ig|instagram|meta)$/.test(source) &&
      /^(cpc|ppc|paid|paidsocial|paid_social|paid-social)$/.test(medium))
  ) {
    return "Facebook / Meta Ads";
  }
  if (
    present(event.ttclid) ||
    /[?&]ttclid=/i.test(location) ||
    source === "tiktok"
  ) {
    return "TikTok";
  }
  if (
    present(event.msclkid) ||
    /[?&]msclkid=/i.test(location) ||
    /^(bing|microsoft)$/.test(source)
  ) {
    return "Microsoft Ads";
  }
  if (isEmailTraffic(source, medium)) {
    return "Email";
  }
  if (
    /^(facebook|fb|ig|instagram|meta)$/.test(source) ||
    referrer.includes("facebook") ||
    referrer.includes("instagram") ||
    referrer.includes("l.facebook")
  ) {
    return "Meta Organic";
  }
  if (
    source === "google" ||
    referrer.includes("google.") ||
    referrer.includes("google.com") ||
    referrer.includes("youtube.com")
  ) {
    return "Google Organic";
  }
  if (hasUtmSource(event)) {
    return "Other";
  }

  const storefront =
    present(event.pageLocation) && !isCheckoutOrPixelPath(event);
  const noExternalReferrer = !present(event.pageReferrer);
  if (storefront && noExternalReferrer && !hasPaidClickId(event) && !hasUtmSource(event)) {
    return DIRECT_CHANNEL;
  }

  if (present(event.pageReferrer) && !isOwnDomainSelfReferral(event)) {
    return "Other";
  }

  return UNKNOWN_CHANNEL;
}

export function isRealDirect(event: EligibilityEvent): boolean {
  return !isInternalNoise(event) && classifyEligibleChannel(event) === DIRECT_CHANNEL;
}

export function isTouchEligible(event: EligibilityEvent): boolean {
  if (isInternalNoise(event)) {
    return false;
  }
  const channel = classifyEligibleChannel(event);
  return channel !== UNKNOWN_CHANNEL || hasUtmSource(event) || hasPaidClickId(event);
}

function clickFrom(event: EligibilityEvent): { clickId: string | null; clickIdType: string | null } {
  if (present(event.gclid) || /[?&]gclid=/i.test(event.pageLocation ?? "")) {
    return { clickId: event.gclid ?? "gclid", clickIdType: "gclid" };
  }
  if (present(event.gbraid)) {
    return { clickId: event.gbraid, clickIdType: "gbraid" };
  }
  if (present(event.wbraid)) {
    return { clickId: event.wbraid, clickIdType: "wbraid" };
  }
  if (present(event.fbclid) || /[?&]fbclid=/i.test(event.pageLocation ?? "")) {
    return { clickId: event.fbclid ?? "fbclid", clickIdType: "fbclid" };
  }
  if (present(event.ttclid)) {
    return { clickId: event.ttclid, clickIdType: "ttclid" };
  }
  if (present(event.msclkid)) {
    return { clickId: event.msclkid, clickIdType: "msclkid" };
  }
  return { clickId: null, clickIdType: null };
}

/**
 * Collapse event rows to one eligible acquisition touch per session.
 * Internal noise is dropped. Duplicate rows in the same session do not become
 * extra touches. Stable id is the canonical session key, not transactionId-index.
 */
export function collapseEventsToSessionTouches(
  events: EligibilityEvent[],
): SessionTouch[] {
  const bySession = new Map<string, EligibilityEvent[]>();
  for (const event of events) {
    if (!event.sessionKey) {
      continue;
    }
    const list = bySession.get(event.sessionKey) ?? [];
    list.push(event);
    bySession.set(event.sessionKey, list);
  }

  const touches: SessionTouch[] = [];
  for (const [sessionKey, rows] of bySession) {
    const eligible = rows
      .filter((event) => !isInternalNoise(event))
      .sort((a, b) => a.timestamp - b.timestamp);
    const first = eligible[0];
    if (!first) {
      continue;
    }
    const channel = classifyEligibleChannel(first);
    if (channel === UNKNOWN_CHANNEL && !hasPaidClickId(first) && !hasUtmSource(first)) {
      continue;
    }
    const click = clickFrom(first);
    touches.push({
      id: sessionKey,
      sessionKey,
      timestamp: first.timestamp,
      channel,
      source: utmSourceOf(first) || null,
      medium: utmMediumOf(first) || null,
      campaign: first.utmCampaign ?? null,
      landingPage: first.pageLocation ?? null,
      clickId: click.clickId,
      clickIdType: click.clickIdType,
      isPaid: (PAID_POLICY_CHANNELS as readonly string[]).includes(channel),
      isDirect: channel === DIRECT_CHANNEL,
      isInternalNoise: false,
      isTouchEligible: true,
    });
  }

  return touches.sort((a, b) => a.timestamp - b.timestamp);
}
