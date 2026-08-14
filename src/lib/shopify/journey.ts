/**
 * Shopify Admin 30-day session journey (customerJourneySummary).
 * Separate from gn_* firstTouchChannel — never fold into that function.
 */

import type { FirstTouch } from "@/lib/shopify/first-touch";

const CLICK_ID_KEYS = [
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "ttclid",
  "msclkid",
] as const;

export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];

export type ShopifyVisitInput = {
  occurredAt?: string | null;
  landingPage?: string | null;
  referrerUrl?: string | null;
  source?: string | null;
  sourceDescription?: string | null;
  sourceType?: string | null;
  referralCode?: string | null;
  marketingEvent?: { id?: string | null; type?: string | null } | null;
  utmParameters?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
    term?: string | null;
  } | null;
};

export type ShopifyVisit = {
  occurredAt: string;
  landingPage: string;
  referrerUrl: string;
  source: string;
  sourceDescription: string;
  sourceType: string;
  referralCode: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  clickIds: Partial<Record<ClickIdKey, string>>;
};

export type ShopifyChannelLabel = {
  channel: string;
  type: string;
  label: string;
  referrerHost: string;
  landingPage: string;
};

export type ShopifyJourney = {
  ready: boolean;
  daysToConversion: number | null;
  customerOrderIndex: number | null;
  firstVisit: ShopifyVisit | null;
  lastVisit: ShopifyVisit | null;
  firstClick: ShopifyChannelLabel;
  lastClick: ShopifyChannelLabel;
};

export type CompareCoarseKey =
  | "Meta paid"
  | "Meta unknown"
  | "Google paid"
  | "Google organic"
  | "Direct"
  | "Email"
  | "Unknown"
  | "Not ready"
  | "Other";

export type JourneyMismatch =
  | "journey_not_ready"
  | "shopify_direct_gn_paid"
  | "shopify_paid_gn_unknown"
  | "channel_mismatch"
  | null;

const PAID_GN_CHANNELS = new Set([
  "Facebook / Meta Ads",
  "Google Ads",
  "TikTok",
  "Microsoft Ads",
]);

export const JOURNEY_GRAPHQL = `
  customerJourneySummary {
    ready
    daysToConversion
    customerOrderIndex
    firstVisit {
      occurredAt
      landingPage
      referrerUrl
      source
      sourceDescription
      sourceType
      referralCode
      marketingEvent { id type }
      utmParameters { source medium campaign content term }
    }
    lastVisit {
      occurredAt
      landingPage
      referrerUrl
      source
      sourceType
      utmParameters { source medium campaign content term }
    }
  }
`;

function lower(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function containsAny(value: string, needles: string[]) {
  const haystack = value.toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

export function truncateReferrer(value: string, max = 64) {
  if (!value) {
    return "";
  }
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

export function clickIdsFromUrl(url: string): Partial<Record<ClickIdKey, string>> {
  const ids: Partial<Record<ClickIdKey, string>> = {};
  if (!url) {
    return ids;
  }

  try {
    const parsed = new URL(url, "https://goodsnova.com");
    for (const key of CLICK_ID_KEYS) {
      const hit = parsed.searchParams.get(key);
      if (hit) {
        ids[key] = hit;
      }
    }
  } catch {
    const query = url.split("?")[1] || "";
    for (const part of query.split("&")) {
      const [rawKey, rawValue] = part.split("=");
      const key = decodeURIComponent(rawKey || "") as ClickIdKey;
      if (CLICK_ID_KEYS.includes(key) && rawValue) {
        ids[key] = decodeURIComponent(rawValue);
      }
    }
  }

  return ids;
}

export function referrerHost(url: string) {
  if (!url) {
    return "";
  }
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase() || "";
  }
}

export function isSelfReferrer(url: string) {
  const host = referrerHost(url);
  return (
    host.includes("goodsnova.com") ||
    host.includes("myshopify.com") ||
    host === "localhost"
  );
}

function paidMedium(medium: string) {
  return containsAny(medium, [
    "cpc",
    "ppc",
    "paid",
    "paidsocial",
    "paid_social",
    "paid-social",
  ]);
}

function isPaidVisit(visit: ShopifyVisit) {
  if (Object.keys(visit.clickIds).length > 0) {
    return true;
  }
  if (paidMedium(visit.utmMedium)) {
    return true;
  }
  const tactic = visit.sourceType.toUpperCase();
  if (tactic === "AD" || tactic === "RETARGETING") {
    return true;
  }
  return false;
}

export function normalizeVisit(
  input: ShopifyVisitInput | null | undefined,
): ShopifyVisit | null {
  if (!input) {
    return null;
  }

  const landingPage = (input.landingPage || "").trim();
  const referrerUrl = (input.referrerUrl || "").trim();
  const cleanedReferrer = isSelfReferrer(referrerUrl) ? "" : referrerUrl;

  return {
    occurredAt: input.occurredAt || "",
    landingPage,
    referrerUrl: cleanedReferrer,
    source: (input.source || "").trim(),
    sourceDescription: (input.sourceDescription || "").trim(),
    sourceType: (input.sourceType || "").trim(),
    referralCode: (input.referralCode || "").trim(),
    utmSource: (input.utmParameters?.source || "").trim(),
    utmMedium: (input.utmParameters?.medium || "").trim(),
    utmCampaign: (input.utmParameters?.campaign || "").trim(),
    utmContent: (input.utmParameters?.content || "").trim(),
    utmTerm: (input.utmParameters?.term || "").trim(),
    clickIds: clickIdsFromUrl(landingPage),
  };
}

function unavailableLabel(): ShopifyChannelLabel {
  return {
    channel: "Unavailable",
    type: "—",
    label: "Unavailable",
    referrerHost: "",
    landingPage: "",
  };
}

function notReadyLabel(): ShopifyChannelLabel {
  return {
    channel: "Not ready",
    type: "—",
    label: "Not ready",
    referrerHost: "",
    landingPage: "",
  };
}

export function classifyShopifyVisit(
  visit: ShopifyVisit | null,
): ShopifyChannelLabel {
  if (!visit) {
    return unavailableLabel();
  }

  const source = lower(visit.source);
  const utmSource = lower(visit.utmSource);
  const utmMedium = lower(visit.utmMedium);
  const host = referrerHost(visit.referrerUrl);
  const combined = `${source} ${utmSource} ${utmMedium} ${host} ${visit.sourceDescription}`;
  const paid = isPaidVisit(visit);
  const hostLabel = host || "";

  const instagram =
    containsAny(combined, ["instagram", "ig "]) || host.includes("instagram.com");
  const facebook =
    !instagram &&
    (containsAny(combined, ["facebook", "fb ", "meta"]) ||
      host.includes("facebook.com"));
  const google =
    containsAny(combined, ["google", "youtube"]) ||
    host.includes("google.") ||
    host.includes("youtube.com") ||
    host.includes("com.google.android.gm");
  const yahoo = containsAny(combined, ["yahoo"]) || host.includes("yahoo.");
  const email =
    containsAny(combined, ["email", "klaviyo", "omnisend", "mail"]) ||
    containsAny(utmMedium, ["email", "sms"]) ||
    yahoo ||
    host.includes("com.google.android.gm");

  if (facebook) {
    const type = paid ? "Paid" : "Unknown";
    return {
      channel: "Facebook",
      type,
      label: `Facebook / ${type}`,
      referrerHost: hostLabel,
      landingPage: visit.landingPage,
    };
  }

  if (instagram) {
    const type = paid ? "Paid" : "Unknown";
    return {
      channel: "Instagram",
      type,
      label: `Instagram / ${type}`,
      referrerHost: hostLabel,
      landingPage: visit.landingPage,
    };
  }

  if (google && !email) {
    const type = paid ? "Paid" : "Organic";
    const channel = type === "Organic" ? "Google Search" : "Google";
    return {
      channel,
      type,
      label: `${channel} / ${type}`,
      referrerHost: hostLabel,
      landingPage: visit.landingPage,
    };
  }

  if (email) {
    const channel = yahoo ? "Yahoo! mail" : google ? "Google" : "Email";
    const type = paid || yahoo || host.includes("android") ? "Paid" : "Email";
    return {
      channel,
      type,
      label: `${channel} / ${type}`,
      referrerHost: hostLabel,
      landingPage: visit.landingPage,
    };
  }

  if (
    source === "direct" ||
    (!source && !host && !visit.utmSource && !paid)
  ) {
    return {
      channel: "Direct",
      type: "Direct",
      label: "Direct / Direct",
      referrerHost: hostLabel,
      landingPage: visit.landingPage,
    };
  }

  if (source) {
    const type = paid ? "Paid" : visit.sourceType || "Unknown";
    return {
      channel: visit.source,
      type,
      label: `${visit.source} / ${type}`,
      referrerHost: hostLabel,
      landingPage: visit.landingPage,
    };
  }

  return {
    channel: "Direct",
    type: "Direct",
    label: "Direct / Direct",
    referrerHost: hostLabel,
    landingPage: visit.landingPage,
  };
}

export function parseShopifyJourney(
  summary:
    | {
        ready?: boolean | null;
        daysToConversion?: number | null;
        customerOrderIndex?: number | null;
        firstVisit?: ShopifyVisitInput | null;
        lastVisit?: ShopifyVisitInput | null;
      }
    | null
    | undefined,
): ShopifyJourney | null {
  if (!summary) {
    return null;
  }

  const ready = Boolean(summary.ready);
  const firstVisit = normalizeVisit(summary.firstVisit);
  const lastVisit = normalizeVisit(summary.lastVisit);

  return {
    ready,
    daysToConversion:
      typeof summary.daysToConversion === "number"
        ? summary.daysToConversion
        : null,
    customerOrderIndex:
      typeof summary.customerOrderIndex === "number"
        ? summary.customerOrderIndex
        : null,
    firstVisit,
    lastVisit,
    firstClick: ready ? classifyShopifyVisit(firstVisit) : notReadyLabel(),
    lastClick: ready ? classifyShopifyVisit(lastVisit) : notReadyLabel(),
  };
}

export function coarseFromShopifyLabel(label: ShopifyChannelLabel): CompareCoarseKey {
  if (label.label === "Not ready") {
    return "Not ready";
  }
  if (label.label === "Unavailable") {
    return "Other";
  }

  const channel = label.channel.toLowerCase();
  const type = label.type.toLowerCase();

  if (channel.includes("facebook") || channel.includes("instagram")) {
    if (type === "paid") {
      return "Meta paid";
    }
    if (type === "unknown") {
      return "Meta unknown";
    }
  }

  if (channel.includes("google")) {
    if (type === "paid") {
      return "Google paid";
    }
    if (type === "organic") {
      return "Google organic";
    }
  }

  if (type === "direct" || channel === "direct") {
    return "Direct";
  }

  if (
    type === "email" ||
    channel.includes("mail") ||
    channel.includes("email")
  ) {
    return "Email";
  }

  return "Other";
}

export function coarseFromGnChannel(channel: string): CompareCoarseKey {
  if (channel === "Unknown") {
    return "Unknown";
  }
  if (channel === "Facebook / Meta Ads") {
    return "Meta paid";
  }
  if (channel === "Meta Organic") {
    return "Meta unknown";
  }
  if (channel === "Google Ads") {
    return "Google paid";
  }
  if (channel === "Google Organic") {
    return "Google organic";
  }
  if (channel === "Direct") {
    return "Direct";
  }
  if (channel === "Email") {
    return "Email";
  }
  return "Other";
}

export function gnHasClickId(firstTouch: FirstTouch) {
  return Boolean(
    firstTouch.fbclid ||
      firstTouch.gclid ||
      firstTouch.gbraid ||
      firstTouch.wbraid ||
      firstTouch.ttclid ||
      firstTouch.msclkid,
  );
}

export function gnIsPaidChannel(channel: string) {
  return PAID_GN_CHANNELS.has(channel);
}

export function journeyMismatch(
  journey: ShopifyJourney | null,
  gnChannel: string,
): JourneyMismatch {
  if (!journey || !journey.ready) {
    return "journey_not_ready";
  }

  const shopifyPaid = journey.firstClick.type.toLowerCase() === "paid";
  const shopifyDirect = journey.firstClick.type.toLowerCase() === "direct";

  if (shopifyDirect && gnIsPaidChannel(gnChannel)) {
    return "shopify_direct_gn_paid";
  }
  if (shopifyPaid && gnChannel === "Unknown") {
    return "shopify_paid_gn_unknown";
  }

  const shopifyKey = coarseFromShopifyLabel(journey.firstClick);
  const gnKey = coarseFromGnChannel(gnChannel);
  if (shopifyKey !== gnKey) {
    return "channel_mismatch";
  }

  return null;
}

export function mismatchLabel(reason: JourneyMismatch) {
  switch (reason) {
    case "journey_not_ready":
      return "Journey not ready";
    case "shopify_direct_gn_paid":
      return "Shopify Direct, gn_* paid";
    case "shopify_paid_gn_unknown":
      return "Shopify Paid, gn_* Unknown";
    case "channel_mismatch":
      return "Channel mismatch";
    default:
      return "";
  }
}

export const SALES_JOURNEY_FILTERS = [
  { key: "", label: "All orders" },
  { key: "shopify_direct_gn_paid", label: "Shopify Direct, gn_* paid" },
  { key: "shopify_paid_gn_unknown", label: "Shopify Paid, gn_* Unknown" },
  { key: "journey_not_ready", label: "Journey not ready" },
] as const;

export type SalesJourneyFilter =
  (typeof SALES_JOURNEY_FILTERS)[number]["key"];
