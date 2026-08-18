import { attributedNcac, platformRoas, ratio } from "../metrics/formulas.ts";

export const CAMPAIGN_MAPPING_STATUS = "VALIDATION REQUIRED" as const;

export type CampaignMapMetaFact = {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchase_value: number;
};

export type CampaignMapOurRow = {
  campaign: string;
  channel: string;
  orders: number;
  revenue: number;
};

export type OurCampaignRow = {
  campaignId: string | null;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  metaPurchases: number;
  metaRevenue: number;
  metaRoas: number | null;
  ourOrders: number;
  ourRevenue: number;
  ourRoas: number | null;
  attributedNcac: number | null;
  differencePct: number | null;
  mapped: boolean;
  mappingStatus: typeof CAMPAIGN_MAPPING_STATUS | "mapped" | "unmapped";
};

function norm(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Join Meta daily facts to OUR campaign credit.
 * Match on exact campaign_id or case-insensitive campaign name.
 * Never allocate spend proportionally to unmapped OUR revenue.
 */
export function joinMetaAndOurCampaigns(
  metaFacts: CampaignMapMetaFact[],
  ourRows: CampaignMapOurRow[],
  newCustomerCreditByCampaign: Record<string, number> = {},
): OurCampaignRow[] {
  const metaByName = new Map<string, {
    campaignId: string;
    campaignName: string;
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    revenue: number;
  }>();
  const metaById = new Map<string, string>();

  for (const fact of metaFacts) {
    const key = norm(fact.campaign_name || fact.campaign_id);
    const current = metaByName.get(key) ?? {
      campaignId: fact.campaign_id,
      campaignName: fact.campaign_name || fact.campaign_id,
      spend: 0,
      impressions: 0,
      clicks: 0,
      purchases: 0,
      revenue: 0,
    };
    current.spend += fact.spend;
    current.impressions += fact.impressions;
    current.clicks += fact.clicks;
    current.purchases += fact.purchases;
    current.revenue += fact.purchase_value;
    metaByName.set(key, current);
    if (fact.campaign_id) {
      metaById.set(fact.campaign_id, key);
    }
  }

  const used = new Set<string>();
  const rows: OurCampaignRow[] = [];

  for (const ours of ourRows) {
    if (ours.campaign === "(unmapped)" || !ours.campaign.trim()) {
      rows.push({
        campaignId: null,
        campaignName: ours.campaign || "(unmapped)",
        spend: 0,
        impressions: 0,
        clicks: 0,
        metaPurchases: 0,
        metaRevenue: 0,
        metaRoas: null,
        ourOrders: ours.orders,
        ourRevenue: ours.revenue,
        ourRoas: null,
        attributedNcac: null,
        differencePct: null,
        mapped: false,
        mappingStatus: "unmapped",
      });
      continue;
    }
    const key = metaById.get(ours.campaign) ?? norm(ours.campaign);
    const meta = metaByName.get(key);
    if (!meta) {
      rows.push({
        campaignId: null,
        campaignName: ours.campaign,
        spend: 0,
        impressions: 0,
        clicks: 0,
        metaPurchases: 0,
        metaRevenue: 0,
        metaRoas: null,
        ourOrders: ours.orders,
        ourRevenue: ours.revenue,
        ourRoas: null,
        attributedNcac: null,
        differencePct: null,
        mapped: false,
        mappingStatus: "unmapped",
      });
      continue;
    }
    used.add(key);
    const ourRoas = ratio(ours.revenue, meta.spend);
    const metaRoasValue = platformRoas(meta.revenue, meta.spend);
    rows.push({
      campaignId: meta.campaignId,
      campaignName: meta.campaignName,
      spend: meta.spend,
      impressions: meta.impressions,
      clicks: meta.clicks,
      metaPurchases: meta.purchases,
      metaRevenue: meta.revenue,
      metaRoas: metaRoasValue,
      ourOrders: ours.orders,
      ourRevenue: ours.revenue,
      ourRoas,
      attributedNcac: attributedNcac(
        meta.spend,
        newCustomerCreditByCampaign[ours.campaign] ?? null,
      ),
      differencePct:
        meta.revenue > 0 ? (ours.revenue - meta.revenue) / meta.revenue : null,
      mapped: true,
      mappingStatus: "mapped",
    });
  }

  for (const [key, meta] of metaByName) {
    if (used.has(key)) {
      continue;
    }
    rows.push({
      campaignId: meta.campaignId,
      campaignName: meta.campaignName,
      spend: meta.spend,
      impressions: meta.impressions,
      clicks: meta.clicks,
      metaPurchases: meta.purchases,
      metaRevenue: meta.revenue,
      metaRoas: platformRoas(meta.revenue, meta.spend),
      ourOrders: 0,
      ourRevenue: 0,
      ourRoas: ratio(0, meta.spend),
      attributedNcac: null,
      differencePct: meta.revenue > 0 ? -1 : null,
      mapped: false,
      mappingStatus: "unmapped",
    });
  }

  return rows.sort((a, b) => b.spend - a.spend || b.ourRevenue - a.ourRevenue);
}
