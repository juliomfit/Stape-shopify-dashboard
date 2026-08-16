import { cache } from "react";
import { getGa4Config } from "@/lib/ads/ga4-config";
import type { DashboardPeriod } from "@/lib/period";
import { getSelectedPeriod } from "@/lib/period-server";
import { isPlatformBqReady, runPlatformQuery } from "@/lib/platform/bq";
import { platformTable } from "@/lib/platform/config";

export type Ga4DailyTotals = {
  sessions: number;
  purchases: number;
  purchaseRevenue: number;
  engagedSessions: number;
  engagementRate: number;
  bounceRate: number;
  avgSessionSeconds: number;
  newUsers: number;
  activeUsers: number;
  addToCarts: number;
  checkouts: number;
  views: number;
};

export type Ga4SourceRow = {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  purchases: number;
  purchaseRevenue: number;
};

export type Ga4BreakdownRow = {
  kind: string;
  label: string;
  sessions: number;
  extra: number;
};

export type Ga4Snapshot = {
  configured: boolean;
  propertyId: string;
  streamId: string;
  measurementId: string;
  periodLabel: string;
  totals: Ga4DailyTotals;
  sources: Ga4SourceRow[];
  devices: Ga4BreakdownRow[];
  countries: Ga4BreakdownRow[];
  landings: Ga4BreakdownRow[];
  searchTerms: Ga4BreakdownRow[];
  googleAdsCampaigns: Ga4BreakdownRow[];
};

function emptyTotals(): Ga4DailyTotals {
  return {
    sessions: 0,
    purchases: 0,
    purchaseRevenue: 0,
    engagedSessions: 0,
    engagementRate: 0,
    bounceRate: 0,
    avgSessionSeconds: 0,
    newUsers: 0,
    activeUsers: 0,
    addToCarts: 0,
    checkouts: 0,
    views: 0,
  };
}

function emptySnapshot(periodLabel: string): Ga4Snapshot {
  const ga4 = getGa4Config();
  return {
    configured: Boolean(ga4),
    propertyId: ga4?.propertyId || "",
    streamId: ga4?.streamId || "",
    measurementId: ga4?.measurementId || "",
    periodLabel,
    totals: emptyTotals(),
    sources: [],
    devices: [],
    countries: [],
    landings: [],
    searchTerms: [],
    googleAdsCampaigns: [],
  };
}

function toNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export const getGa4Snapshot = cache(async (period?: DashboardPeriod): Promise<Ga4Snapshot> => {
  const selected = period ?? (await getSelectedPeriod());
  const base = emptySnapshot(selected.label);
  const ga4 = getGa4Config();
  if (!ga4 || !isPlatformBqReady()) {
    return base;
  }
  const metricsTable = platformTable("raw_ga4_metrics");
  const sourcesTable = platformTable("raw_ga4_sources");
  const breakdownsTable = platformTable("raw_ga4_breakdowns");
  if (!metricsTable || !sourcesTable || !breakdownsTable) {
    return base;
  }

  try {
    const [metricRows, sourceRows, breakdownRows] = await Promise.all([
      runPlatformQuery<Record<string, unknown>>(
        `
        SELECT
          SUM(sessions) AS sessions,
          SUM(purchases) AS purchases,
          SUM(purchase_revenue) AS purchase_revenue,
          SUM(engaged_sessions) AS engaged_sessions,
          AVG(engagement_rate) AS engagement_rate,
          AVG(bounce_rate) AS bounce_rate,
          AVG(avg_session_seconds) AS avg_session_seconds,
          SUM(new_users) AS new_users,
          SUM(active_users) AS active_users,
          SUM(add_to_carts) AS add_to_carts,
          SUM(checkouts) AS checkouts,
          SUM(views) AS views
        FROM (
          SELECT * EXCEPT (rn)
          FROM (
            SELECT
              t.*,
              ROW_NUMBER() OVER (PARTITION BY date ORDER BY synced_at DESC) AS rn
            FROM ${metricsTable} t
            WHERE property_id = @propertyId
              AND date BETWEEN @startDate AND @endDate
          )
          WHERE rn = 1
        )
        `,
        {
          propertyId: ga4.propertyId,
          startDate: selected.startDate,
          endDate: selected.endDate,
        },
      ),
      runPlatformQuery<Record<string, unknown>>(
        `
        SELECT source, medium, campaign,
          SUM(sessions) AS sessions,
          SUM(purchases) AS purchases,
          SUM(purchase_revenue) AS purchase_revenue
        FROM (
          SELECT * EXCEPT (rn)
          FROM (
            SELECT
              t.*,
              ROW_NUMBER() OVER (
                PARTITION BY date, source, medium, campaign
                ORDER BY synced_at DESC
              ) AS rn
            FROM ${sourcesTable} t
            WHERE property_id = @propertyId
              AND date BETWEEN @startDate AND @endDate
          )
          WHERE rn = 1
        )
        GROUP BY 1, 2, 3
        ORDER BY sessions DESC
        LIMIT 40
        `,
        {
          propertyId: ga4.propertyId,
          startDate: selected.startDate,
          endDate: selected.endDate,
        },
      ),
      runPlatformQuery<Record<string, unknown>>(
        `
        SELECT kind, label, SUM(sessions) AS sessions, SUM(extra) AS extra
        FROM (
          SELECT * EXCEPT (rn)
          FROM (
            SELECT
              t.*,
              ROW_NUMBER() OVER (PARTITION BY date, kind, label ORDER BY synced_at DESC) AS rn
            FROM ${breakdownsTable} t
            WHERE property_id = @propertyId
              AND date BETWEEN @startDate AND @endDate
          )
          WHERE rn = 1
        )
        GROUP BY 1, 2
        ORDER BY sessions DESC
        `,
        {
          propertyId: ga4.propertyId,
          startDate: selected.startDate,
          endDate: selected.endDate,
        },
      ),
    ]);

    const totalsRow = metricRows[0] || {};
    const byKind = (kind: string): Ga4BreakdownRow[] =>
      breakdownRows
        .filter((row) => String(row.kind || "") === kind)
        .slice(0, 20)
        .map((row) => ({
          kind,
          label: String(row.label || "(not set)"),
          sessions: toNumber(row.sessions),
          extra: toNumber(row.extra),
        }));

    return {
      ...base,
      totals: {
        sessions: toNumber(totalsRow.sessions),
        purchases: toNumber(totalsRow.purchases),
        purchaseRevenue: toNumber(totalsRow.purchase_revenue),
        engagedSessions: toNumber(totalsRow.engaged_sessions),
        engagementRate: toNumber(totalsRow.engagement_rate),
        bounceRate: toNumber(totalsRow.bounce_rate),
        avgSessionSeconds: toNumber(totalsRow.avg_session_seconds),
        newUsers: toNumber(totalsRow.new_users),
        activeUsers: toNumber(totalsRow.active_users),
        addToCarts: toNumber(totalsRow.add_to_carts),
        checkouts: toNumber(totalsRow.checkouts),
        views: toNumber(totalsRow.views),
      },
      sources: sourceRows.map((row) => ({
        source: String(row.source || "(direct)"),
        medium: String(row.medium || "(none)"),
        campaign: String(row.campaign || "(not set)"),
        sessions: toNumber(row.sessions),
        purchases: toNumber(row.purchases),
        purchaseRevenue: toNumber(row.purchase_revenue),
      })),
      devices: byKind("device"),
      countries: byKind("country"),
      landings: byKind("landing"),
        searchTerms: [
          ...byKind("search_term"),
          ...byKind("search_console"),
        ].slice(0, 20),
      googleAdsCampaigns: byKind("google_ads_campaign"),
    };
  } catch {
    return base;
  }
});
