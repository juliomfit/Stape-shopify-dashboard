import { rememberDashboard } from "@/lib/dashboard/remember";
import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { getBigQueryClient } from "@/lib/stape/client";
import { CHANNEL_SQL } from "@/lib/stape/channel-sql";
import { eventsFromSql, getBigQueryConfig } from "@/lib/stape/config";
import type { DashboardPeriod } from "@/lib/period";
import type { StapeConnectionStatus } from "@/lib/stape/types";

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  note?: string;
};

export type StapeDailyPoint = {
  date: string;
  sessions: number;
  pageviews: number;
};

export type StapeFunnelMetrics = {
  status: StapeConnectionStatus;
  periodLabel: string;
  sessions: number;
  users: number;
  pageviews: number;
  facebookSessions: number;
  landingSessions: number;
  addToCartSessions: number;
  checkoutSessions: number;
  purchases: number;
  purchaseRevenue: number;
  steps: FunnelStep[];
  daily: StapeDailyPoint[];
};

function toNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function emptyMetrics(periodLabel: string): StapeFunnelMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel,
    sessions: 0,
    users: 0,
    pageviews: 0,
    facebookSessions: 0,
    landingSessions: 0,
    addToCartSessions: 0,
    checkoutSessions: 0,
    purchases: 0,
    purchaseRevenue: 0,
    steps: [],
    daily: [],
  };
}

function funnelSteps(
  sessions: number,
  facebookSessions: number,
  landingSessions: number,
  addToCartSessions: number,
  checkoutSessions: number,
  purchases: number,
): FunnelStep[] {
  return [
    {
      key: "sessions",
      label: "Clicks / sessions",
      count: sessions,
      note:
        facebookSessions > 0
          ? `${facebookSessions.toLocaleString("en-US")} from Facebook / Meta Ads`
          : undefined,
    },
    {
      key: "landing",
      label: "Landing page views",
      count: landingSessions,
    },
    {
      key: "cart",
      label: "Add to cart",
      count: addToCartSessions,
    },
    {
      key: "checkout",
      label: "Checkout",
      count: checkoutSessions,
    },
    {
      key: "purchase",
      label: "Stape purchases",
      count: purchases,
      note: "Comparable to Shopify orders for the same header dates — not estimated from sessions",
    },
  ];
}

async function loadFunnelMetrics(
  period: DashboardPeriod,
): Promise<StapeFunnelMetrics> {
  try {
    if (!getBigQueryConfig()) {
      return emptyMetrics(period.label);
    }

    const { client, config } = getBigQueryClient();
    const table = eventsFromSql(config);
    const queryOptions = { location: config.location };
    const params = { startMs: period.startMs, endMs: period.endMs };
    const [rows] = await client.query({
      ...queryOptions,
      params,
      query: `
        WITH events AS (
          SELECT
            CONCAT(IFNULL(client_id, ''), '|', IFNULL(ga_session_id, '')) AS session_key,
            client_id,
            timestamp,
            LOWER(IFNULL(event_name, '')) AS event_name,
            LOWER(IFNULL(page_location, '')) AS page_location,
            LOWER(IFNULL(page_referrer, '')) AS page_referrer,
            IFNULL(gclid, '') AS gclid,
            IFNULL(gbraid, '') AS gbraid,
            IFNULL(wbraid, '') AS wbraid,
            IFNULL(dclid, '') AS dclid,
            IFNULL(fbclid, '') AS fbclid,
            IFNULL(fbc, '') AS fbc,
            IFNULL(ttclid, '') AS ttclid,
            IFNULL(msclkid, '') AS msclkid,
            transaction_id,
            value
          FROM ${table}
          WHERE timestamp >= @startMs
            AND timestamp < @endMs
        ),
        first_touch AS (
          SELECT * EXCEPT (rn)
          FROM (
            SELECT
              events.*,
              ROW_NUMBER() OVER (PARTITION BY session_key ORDER BY timestamp) AS rn
            FROM events
            WHERE session_key != '|'
          )
          WHERE rn = 1
        ),
        session_channels AS (
          SELECT
            session_key,
            ${CHANNEL_SQL} AS channel
          FROM first_touch
        ),
        unique_orders AS (
          SELECT
            transaction_id,
            MAX(value) AS revenue
          FROM events
          WHERE event_name = 'purchase'
            AND IFNULL(transaction_id, '') != ''
          GROUP BY transaction_id
        ),
        daily AS (
          SELECT
            FORMAT_DATE('%Y-%m-%d', DATE(TIMESTAMP_MILLIS(timestamp), 'America/Los_Angeles')) AS day,
            COUNT(DISTINCT IF(session_key != '|', session_key, NULL)) AS sessions,
            COUNTIF(event_name = 'page_view') AS pageviews
          FROM events
          GROUP BY 1
        )
        SELECT
          (SELECT COUNT(*) FROM session_channels) AS sessions,
          (SELECT COUNT(DISTINCT client_id) FROM events WHERE session_key != '|') AS users,
          (SELECT COUNT(*) FROM events WHERE event_name = 'page_view') AS pageviews,
          (SELECT COUNTIF(channel = 'Facebook / Meta Ads') FROM session_channels) AS facebook_sessions,
          (SELECT COUNT(DISTINCT session_key) FROM events WHERE event_name = 'page_view' AND session_key != '|') AS landing_sessions,
          (SELECT COUNT(DISTINCT session_key) FROM events WHERE event_name = 'add_to_cart' AND session_key != '|') AS add_to_cart_sessions,
          (SELECT COUNT(DISTINCT session_key) FROM events WHERE event_name = 'begin_checkout' AND session_key != '|') AS checkout_sessions,
          (SELECT COUNT(*) FROM unique_orders) AS purchases,
          (SELECT IFNULL(SUM(revenue), 0) FROM unique_orders) AS purchase_revenue,
          ARRAY(SELECT AS STRUCT day, sessions, pageviews FROM daily ORDER BY day) AS daily
      `,
    });

    const row = (rows[0] ?? {}) as Record<string, unknown>;
    const dailyRows = (row.daily ?? []) as {
      day?: string;
      sessions?: unknown;
      pageviews?: unknown;
    }[];
    const sessions = toNumber(row.sessions);
    const users = toNumber(row.users);
    const pageviews = toNumber(row.pageviews);
    const facebookSessions = toNumber(row.facebook_sessions);
    const landingSessions = toNumber(row.landing_sessions);
    const addToCartSessions = toNumber(row.add_to_cart_sessions);
    const checkoutSessions = toNumber(row.checkout_sessions);
    const purchases = toNumber(row.purchases);
    const purchaseRevenue = toNumber(row.purchase_revenue);

    return {
      status: { state: "connected", projectId: config.projectId },
      periodLabel: period.label,
      sessions,
      users,
      pageviews,
      facebookSessions,
      landingSessions,
      addToCartSessions,
      checkoutSessions,
      purchases,
      purchaseRevenue,
      steps: funnelSteps(
        sessions,
        facebookSessions,
        landingSessions,
        addToCartSessions,
        checkoutSessions,
        purchases,
      ),
      daily: dailyRows.map(
        (point) => ({
          date: String(point.day || ""),
          sessions: toNumber(point.sessions),
          pageviews: toNumber(point.pageviews),
        }),
      ),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load funnel data.";

    return {
      ...emptyMetrics(period.label),
      status: { state: "error", message },
    };
  }
}

export async function getStapeFunnelMetricsForPeriod(
  period: DashboardPeriod,
): Promise<StapeFunnelMetrics> {
  return rememberDashboard(
    ["stape-funnel", String(period.startMs), String(period.endMs)],
    () => loadFunnelMetrics(period),
  );
}

export async function getStapeFunnelMetrics(): Promise<StapeFunnelMetrics> {
  return getStapeFunnelMetricsForPeriod(await getAlignedPeriod());
}
