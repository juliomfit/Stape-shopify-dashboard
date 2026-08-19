import { isPlatformBqReady, runPlatformQuery } from "@/lib/platform/bq";
import { platformTable } from "@/lib/platform/config";
import {
  formatMetaFactTableCounts,
  type MetaFactTableCounts,
} from "@/lib/ads/meta-fact-format";

export { formatMetaFactTableCounts };
export type { MetaFactTableCounts };

function asCount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && value && "value" in value) {
    return asCount((value as { value?: unknown }).value);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Live warehouse row counts. Null/unavailable when BigQuery is not ready or
 * a table cannot be read. Never invents 0 for a missing query.
 */
export async function getMetaFactTableCounts(): Promise<MetaFactTableCounts> {
  const unavailable: MetaFactTableCounts = {
    available: false,
    campaigns: null,
    adsets: null,
    ads: null,
  };
  if (!isPlatformBqReady()) return unavailable;
  const campaigns = platformTable("meta_campaign_insights_daily");
  const adsets = platformTable("meta_adset_insights_daily");
  const ads = platformTable("meta_ad_insights_daily");
  if (!campaigns || !adsets || !ads) return unavailable;
  try {
    const rows = await runPlatformQuery<{
      campaigns?: unknown;
      adsets?: unknown;
      ads?: unknown;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM ${campaigns}) AS campaigns,
        (SELECT COUNT(*) FROM ${adsets}) AS adsets,
        (SELECT COUNT(*) FROM ${ads}) AS ads`,
    );
    const row = rows[0];
    if (!row) return unavailable;
    const campaignCount = asCount(row.campaigns);
    const adsetCount = asCount(row.adsets);
    const adCount = asCount(row.ads);
    if (campaignCount == null || adsetCount == null || adCount == null) return unavailable;
    return {
      available: true,
      campaigns: campaignCount,
      adsets: adsetCount,
      ads: adCount,
    };
  } catch {
    return unavailable;
  }
}
