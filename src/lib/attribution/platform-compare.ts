export type ChannelCell = {
  revenue: number;
  orders: number;
};

export type PlatformClaimInput = {
  channel: string;
  spend: number | null;
  purchases: number | null;
  revenue: number | null;
};

export type PlatformVsOurRow = {
  channel: string;
  spend: number | null;
  platformPurchases: number | null;
  platformRevenue: number | null;
  ourOrders: number;
  ourRevenue: number;
};

/** Engine channel names that match `src/lib/stape/channel-sql.ts`. */
export const PLATFORM_ENGINE_CHANNELS = {
  facebook: "Facebook / Meta Ads",
  google: "Google Ads",
} as const;

/**
 * Merge Ads Manager / warehouse claims with our engine rollup.
 * Platform channels come first; other engine channels with attributed
 * revenue follow. Missing platform numbers stay null (shown as —).
 */
export function buildPlatformVsOurRows(
  claims: PlatformClaimInput[],
  ourByChannel: Record<string, ChannelCell>,
): PlatformVsOurRow[] {
  const seen = new Set<string>();
  const rows: PlatformVsOurRow[] = [];

  for (const claim of claims) {
    seen.add(claim.channel);
    const ours = ourByChannel[claim.channel];
    rows.push({
      channel: claim.channel,
      spend: claim.spend,
      platformPurchases: claim.purchases,
      platformRevenue: claim.revenue,
      ourOrders: ours?.orders ?? 0,
      ourRevenue: ours?.revenue ?? 0,
    });
  }

  const extras = Object.entries(ourByChannel)
    .filter(([channel, cell]) => !seen.has(channel) && cell.revenue > 0)
    .sort((a, b) => b[1].revenue - a[1].revenue);

  for (const [channel, cell] of extras) {
    rows.push({
      channel,
      spend: null,
      platformPurchases: null,
      platformRevenue: null,
      ourOrders: cell.orders,
      ourRevenue: cell.revenue,
    });
  }

  return rows;
}
