/**
 * First-touch comes from storefront gn_* cart attributes on the Shopify
 * order (customAttributes / note_attributes), not Shopify session details.
 */

export type ShopifyAttribute = {
  key?: string | null;
  name?: string | null;
  value?: string | null;
};

export type FirstTouch = {
  uid: string;
  ts: string;
  landingPath: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  fbclid: string;
  msclkid: string;
  ttclid: string;
};

export const EMPTY_FIRST_TOUCH: FirstTouch = {
  uid: "",
  ts: "",
  landingPath: "",
  referrer: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmContent: "",
  utmTerm: "",
  gclid: "",
  gbraid: "",
  wbraid: "",
  fbclid: "",
  msclkid: "",
  ttclid: "",
};

const KEY_MAP: Record<string, keyof FirstTouch> = {
  gn_uid: "uid",
  gn_first_touch_ts: "ts",
  gn_landing_path: "landingPath",
  gn_referrer: "referrer",
  gn_utm_source: "utmSource",
  gn_utm_medium: "utmMedium",
  gn_utm_campaign: "utmCampaign",
  gn_utm_content: "utmContent",
  gn_utm_term: "utmTerm",
  gn_gclid: "gclid",
  gn_gbraid: "gbraid",
  gn_wbraid: "wbraid",
  gn_fbclid: "fbclid",
  gn_msclkid: "msclkid",
  gn_ttclid: "ttclid",
};

export function normalizeOrderName(value: string | null | undefined) {
  return (value || "").trim().replace(/^#/, "");
}

export function parseFirstTouch(attributes: ShopifyAttribute[] | null | undefined): FirstTouch {
  const firstTouch = { ...EMPTY_FIRST_TOUCH };

  for (const attribute of attributes || []) {
    const rawKey = (attribute.key || attribute.name || "").trim().toLowerCase();
    const field = KEY_MAP[rawKey];
    if (!field) {
      continue;
    }

    firstTouch[field] = (attribute.value || "").trim();
  }

  return firstTouch;
}

export function hasFirstTouchSignal(firstTouch: FirstTouch) {
  return Object.values(firstTouch).some((value) => value !== "");
}

function containsAny(value: string, needles: string[]) {
  const haystack = value.toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

function paidMedium(medium: string) {
  return containsAny(medium, ["cpc", "ppc", "paid", "paidsocial", "paid_social"]);
}

function referrerChannel(referrer: string) {
  const host = referrer.toLowerCase();
  if (!host) {
    return null;
  }

  if (
    containsAny(host, [
      "facebook.com",
      "l.facebook.com",
      "lm.facebook.com",
      "m.facebook.com",
      "instagram.com",
      "l.instagram.com",
    ])
  ) {
    return "Meta Organic";
  }

  if (containsAny(host, ["google.", "google.com", "youtube.com"])) {
    return "Google Organic";
  }

  if (containsAny(host, ["tiktok.com"])) {
    return "TikTok";
  }

  if (containsAny(host, ["bing.com", "microsoft.com"])) {
    return "Microsoft Ads";
  }

  return null;
}

function utmChannel(source: string, medium: string) {
  if (containsAny(medium, ["email", "sms"]) || containsAny(source, ["klaviyo", "omnisend", "postscript", "attentive", "email", "sms"])) {
    return "Email";
  }

  if (containsAny(source, ["google"]) && (paidMedium(medium) || medium === "organic")) {
    return medium === "organic" ? "Google Organic" : "Google Ads";
  }

  if (containsAny(source, ["facebook", "fb", "ig", "instagram", "meta"])) {
    return paidMedium(medium) ? "Facebook / Meta Ads" : "Meta Organic";
  }

  if (containsAny(source, ["tiktok"])) {
    return "TikTok";
  }

  if (source && medium) {
    return `${source} / ${medium}`;
  }

  return null;
}

/** First-touch channel from gn_* only. Never uses Shopify session/last-touch. */
export function firstTouchChannel(firstTouch: FirstTouch) {
  if (!hasFirstTouchSignal(firstTouch)) {
    return "Unknown";
  }

  if (firstTouch.gclid || firstTouch.gbraid || firstTouch.wbraid) {
    return "Google Ads";
  }

  if (
    firstTouch.fbclid ||
    (containsAny(firstTouch.utmSource, ["facebook", "fb", "ig", "instagram", "meta"]) &&
      paidMedium(firstTouch.utmMedium))
  ) {
    return "Facebook / Meta Ads";
  }

  if (firstTouch.ttclid) {
    return "TikTok";
  }

  if (firstTouch.msclkid) {
    return "Microsoft Ads";
  }

  const fromUtm = utmChannel(firstTouch.utmSource, firstTouch.utmMedium);
  if (fromUtm) {
    return fromUtm;
  }

  const fromReferrer = referrerChannel(firstTouch.referrer);
  if (fromReferrer) {
    return fromReferrer;
  }

  return "Direct";
}

export function clickIdLabel(firstTouch: FirstTouch) {
  const ids: [string, string][] = [
    ["fbclid", firstTouch.fbclid],
    ["gclid", firstTouch.gclid],
    ["gbraid", firstTouch.gbraid],
    ["wbraid", firstTouch.wbraid],
    ["ttclid", firstTouch.ttclid],
    ["msclkid", firstTouch.msclkid],
  ];

  const hit = ids.find(([, value]) => value);
  if (!hit) {
    return "";
  }

  return `${hit[0]} ${truncateClickId(hit[1])}`;
}

export function truncateClickId(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 8)}…`;
}

export type FirstTouchRollup = {
  label: string;
  orders: number;
  revenue: number;
  newCustomerOrders: number;
  newCustomerRevenue: number;
  spend: number | null;
  roas: number | null;
  newCustomerRoas: number | null;
};

function withEconomics(
  row: Omit<FirstTouchRollup, "spend" | "roas" | "newCustomerRoas">,
  spend: number | null,
): FirstTouchRollup {
  return {
    ...row,
    spend,
    roas: spend && spend > 0 ? row.revenue / spend : null,
    newCustomerRoas:
      spend && spend > 0 ? row.newCustomerRevenue / spend : null,
  };
}

export function findRollup(rows: FirstTouchRollup[], label: string) {
  return rows.find((row) => row.label === label) ?? null;
}

export function rollupFirstTouch(
  rows: {
    amount: number;
    isNew?: boolean | null;
    firstTouchChannel: string;
    firstTouch: FirstTouch;
  }[],
  groupBy: "channel" | "campaign",
  spendByLabel: Record<string, number | null> = {},
): FirstTouchRollup[] {
  const groups = new Map<
    string,
    Omit<FirstTouchRollup, "spend" | "roas" | "newCustomerRoas">
  >();

  for (const row of rows) {
    const label =
      groupBy === "campaign"
        ? row.firstTouch.utmCampaign || "(no campaign)"
        : row.firstTouchChannel || "Unknown";
    const current = groups.get(label) ?? {
      label,
      orders: 0,
      revenue: 0,
      newCustomerOrders: 0,
      newCustomerRevenue: 0,
    };

    current.orders += 1;
    current.revenue += row.amount;
    if (row.isNew === true) {
      current.newCustomerOrders += 1;
      current.newCustomerRevenue += row.amount;
    }

    groups.set(label, current);
  }

  return [...groups.values()]
    .map((row) => withEconomics(row, spendByLabel[row.label] ?? null))
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
}
