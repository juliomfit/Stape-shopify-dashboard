export const DEEP_GRAIN_MISSING_IDS = "DEEP_GRAIN_MISSING_IDS";

export type InsightGrainLevel = "campaign" | "adset" | "ad";

export type InsightIdFields = {
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
};

export type InsightGrainIdReport = {
  raw_rows: number;
  valid_campaign_id_rows: number;
  valid_adset_id_rows: number;
  valid_ad_id_rows: number;
};

function nonempty(value: string | null | undefined) {
  return Boolean(value && String(value).trim());
}

export function insightGrainIdReport(rows: readonly InsightIdFields[]): InsightGrainIdReport {
  let valid_campaign_id_rows = 0;
  let valid_adset_id_rows = 0;
  let valid_ad_id_rows = 0;
  for (const row of rows) {
    if (nonempty(row.campaignId)) valid_campaign_id_rows += 1;
    if (nonempty(row.adsetId)) valid_adset_id_rows += 1;
    if (nonempty(row.adId)) valid_ad_id_rows += 1;
  }
  return {
    raw_rows: rows.length,
    valid_campaign_id_rows,
    valid_adset_id_rows,
    valid_ad_id_rows,
  };
}

export function acceptedInsightRowsForGrain<T extends InsightIdFields>(
  level: InsightGrainLevel,
  rows: readonly T[],
): T[] {
  if (level === "adset") return rows.filter((row) => nonempty(row.adsetId));
  if (level === "ad") return rows.filter((row) => nonempty(row.adId));
  return rows.filter((row) => nonempty(row.campaignId));
}

export function deepGrainMissingIdsReason(
  level: InsightGrainLevel,
  rows: readonly InsightIdFields[],
): string | null {
  if (level === "campaign") return null;
  if (!rows.length) return null;
  const accepted = acceptedInsightRowsForGrain(level, rows);
  if (accepted.length === 0) return DEEP_GRAIN_MISSING_IDS;
  return null;
}

export function countableGrainRows<T extends InsightIdFields>(
  level: InsightGrainLevel,
  rows: readonly T[],
): { rows: T[]; count: number; skip?: string; report: InsightGrainIdReport } {
  const report = insightGrainIdReport(rows);
  const skip = deepGrainMissingIdsReason(level, rows) ?? undefined;
  const accepted = skip ? [] : acceptedInsightRowsForGrain(level, rows);
  return {
    rows: accepted,
    count: accepted.length,
    skip,
    report,
  };
}
