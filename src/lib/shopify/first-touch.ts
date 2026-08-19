/**
 * First-touch comes from storefront gn_* cart attributes on the Shopify
 * order (customAttributes / note_attributes), not Shopify session details.
 */
import { isEmailTraffic, observedSource } from "../tracking/observed-source.ts";

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
  metaCampaignId: string;
  metaAdsetId: string;
  metaAdId: string;
  metaCampaignName: string;
  metaAdsetName: string;
  metaAdName: string;
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
  metaCampaignId: "",
  metaAdsetId: "",
  metaAdId: "",
  metaCampaignName: "",
  metaAdsetName: "",
  metaAdName: "",
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
  gn_meta_campaign_id: "metaCampaignId",
  gn_meta_adset_id: "metaAdsetId",
  gn_meta_ad_id: "metaAdId",
  gn_meta_campaign_name: "metaCampaignName",
  gn_meta_adset_name: "metaAdsetName",
  gn_meta_ad_name: "metaAdName",
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
  if (isEmailTraffic(source, medium)) {
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
    firstTouch.metaCampaignId ||
    firstTouch.metaAdsetId ||
    firstTouch.metaAdId ||
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

  if (firstTouch.utmSource.trim()) {
    return "Other";
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
  source: string;
  medium: string;
  channel: string;
  orders: number;
  paidOrders: number;
  revenue: number;
  newCustomerOrders: number;
  newCustomerRevenue: number;
  repeatOrders: number;
  spend: number | null;
  roas: number | null;
  newCustomerRoas: number | null;
  cpa: number | null;
  ncCpa: number | null;
};

export type FirstTouchGroupBy = "source" | "channel" | "campaign" | "source_medium";

const PAID_SPEND_CHANNELS = new Set(["Facebook / Meta Ads", "Google Ads"]);

/**
 * Source / medium from gn_* only. Click ids with empty UTM use the same
 * channel names as firstTouchChannel. Missing gn_* stays Unknown.
 */
export function sourceMediumParts(
  firstTouch: FirstTouch,
  channel: string,
): { source: string; medium: string } {
  if (!hasFirstTouchSignal(firstTouch)) {
    return { source: "Unknown", medium: "—" };
  }

  const source = firstTouch.utmSource.trim();
  const medium = firstTouch.utmMedium.trim();
  if (source || medium) {
    return {
      source: source || "(no source)",
      medium: medium || "(no medium)",
    };
  }

  if (firstTouch.gclid || firstTouch.gbraid || firstTouch.wbraid) {
    return { source: "Google Ads", medium: "—" };
  }
  if (firstTouch.fbclid) {
    return { source: "Facebook / Meta Ads", medium: "—" };
  }
  if (firstTouch.ttclid) {
    return { source: "TikTok", medium: "—" };
  }
  if (firstTouch.msclkid) {
    return { source: "Microsoft Ads", medium: "—" };
  }

  return { source: channel || "Direct", medium: "—" };
}

type RollupBase = Omit<
  FirstTouchRollup,
  "spend" | "roas" | "newCustomerRoas" | "cpa" | "ncCpa"
>;

function withEconomics(row: RollupBase, spend: number | null): FirstTouchRollup {
  const usableSpend = spend !== null && spend > 0 ? spend : null;

  return {
    ...row,
    spend: usableSpend,
    roas: usableSpend ? row.revenue / usableSpend : null,
    newCustomerRoas: usableSpend ? row.newCustomerRevenue / usableSpend : null,
    cpa: usableSpend && row.paidOrders > 0 ? usableSpend / row.paidOrders : null,
    ncCpa:
      usableSpend && row.newCustomerOrders > 0
        ? usableSpend / row.newCustomerOrders
        : null,
  };
}

export function findRollup(rows: FirstTouchRollup[], label: string) {
  return rows.find((row) => row.label === label) ?? null;
}

function emptyGroup(
  label: string,
  source: string,
  medium: string,
  channel: string,
): RollupBase {
  return {
    label,
    source,
    medium,
    channel,
    orders: 0,
    paidOrders: 0,
    revenue: 0,
    newCustomerOrders: 0,
    newCustomerRevenue: 0,
    repeatOrders: 0,
  };
}

/**
 * Account-level Meta/Google spend attaches to a source/medium row only when
 * that paid channel has exactly one row. Splitting blended spend across
 * facebook/cpc and facebook/paidsocial would invent allocation.
 */
export function attachUniqueChannelSpend(
  rows: FirstTouchRollup[],
  spendByChannel: Record<string, number | null>,
): FirstTouchRollup[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (PAID_SPEND_CHANNELS.has(row.channel)) {
      counts.set(row.channel, (counts.get(row.channel) ?? 0) + 1);
    }
  }

  return rows.map((row) => {
    const unique = counts.get(row.channel) === 1;
    const spend =
      unique && PAID_SPEND_CHANNELS.has(row.channel)
        ? spendByChannel[row.channel] ?? null
        : null;

    return withEconomics(
      {
        label: row.label,
        source: row.source,
        medium: row.medium,
        channel: row.channel,
        orders: row.orders,
        paidOrders: row.paidOrders,
        revenue: row.revenue,
        newCustomerOrders: row.newCustomerOrders,
        newCustomerRevenue: row.newCustomerRevenue,
        repeatOrders: row.repeatOrders,
      },
      spend,
    );
  });
}

export function sourceMediumSpendNote(
  rows: FirstTouchRollup[],
  facebookSpend: number | null,
  googleSpend: number | null,
): string | null {
  const notes: string[] = [];
  const facebookRows = rows.filter((row) => row.channel === "Facebook / Meta Ads");
  const googleRows = rows.filter((row) => row.channel === "Google Ads");
  if (facebookRows.length > 1 && facebookSpend !== null) {
    notes.push(
      "Meta spend is account-level. Multiple Facebook source/medium rows — spend stays — here; use Channel for Meta ROAS.",
    );
  }
  if (googleRows.length > 1 && googleSpend !== null) {
    notes.push(
      "Google spend is account-level. Multiple Google Ads source/medium rows — spend stays — here; use Channel for Google ROAS.",
    );
  }

  return notes.length > 0 ? notes.join(" ") : null;
}

export function buildAttributionRollups(
  rows: {
    amount: number;
    isNew?: boolean | null;
    firstTouchChannel: string;
    firstTouch: FirstTouch;
  }[],
  spendByChannel: Record<string, number | null>,
  campaignSpend: Record<string, number | null> = {},
) {
  const byChannel = rollupFirstTouch(rows, "channel", spendByChannel);
  const bySource = attachUniqueChannelSpend(
    rollupFirstTouch(rows, "source"),
    spendByChannel,
  );
  const bySourceMedium = attachUniqueChannelSpend(
    rollupFirstTouch(rows, "source_medium"),
    spendByChannel,
  );
  const byCampaign = rollupFirstTouch(rows, "campaign", campaignSpend);

  return { byChannel, bySource, bySourceMedium, byCampaign };
}

export function rollupFirstTouch(
  rows: {
    amount: number;
    isNew?: boolean | null;
    firstTouchChannel: string;
    firstTouch: FirstTouch;
  }[],
  groupBy: FirstTouchGroupBy,
  spendByLabel: Record<string, number | null> = {},
): FirstTouchRollup[] {
  const groups = new Map<string, RollupBase>();

  for (const row of rows) {
    const channel = row.firstTouchChannel || "Unknown";
    const parts = sourceMediumParts(row.firstTouch, channel);
    let label: string;
    let source: string;
    let medium: string;

    if (groupBy === "campaign") {
      label = row.firstTouch.utmCampaign || "(no campaign)";
      source = label;
      medium = "—";
    } else if (groupBy === "source") {
      source = observedSource(row.firstTouch);
      medium = parts.medium;
      label = source;
    } else if (groupBy === "source_medium") {
      source = parts.source;
      medium = parts.medium;
      label = medium === "—" ? source : `${source} / ${medium}`;
    } else {
      label = channel;
      source = channel;
      medium = "—";
    }

    const current = groups.get(label) ?? emptyGroup(label, source, medium, channel);
    current.orders += 1;
    current.revenue += row.amount;
    if (row.amount > 0) {
      current.paidOrders += 1;
    }
    if (row.isNew === true) {
      current.newCustomerOrders += 1;
      current.newCustomerRevenue += row.amount;
    } else if (row.isNew === false) {
      current.repeatOrders += 1;
    }

    groups.set(label, current);
  }

  return [...groups.values()]
    .map((row) => withEconomics(row, spendByLabel[row.label] ?? null))
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
}
