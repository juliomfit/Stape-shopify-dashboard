import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { getBigQueryClient } from "@/lib/stape/client";
import { CHANNEL_SQL } from "@/lib/stape/channel-sql";
import { eventsFromSql, getBigQueryConfig } from "@/lib/stape/config";
import type { StapeConnectionStatus } from "@/lib/stape/types";

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  note?: string;
};

export type StapeFunnelMetrics = {
  status: StapeConnectionStatus;
  periodLabel: string;
  sessions: number;
  facebookSessions: number;
  landingSessions: number;
  addToCartSessions: number;
  checkoutSessions: number;
  purchases: number;
  purchaseRevenue: number;
  steps: FunnelStep[];
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
    facebookSessions: 0,
    landingSessions: 0,
    addToCartSessions: 0,
    checkoutSessions: 0,
    purchases: 0,
    purchaseRevenue: 0,
    steps: [],
  };
}

export async function getStapeFunnelMetrics(): Promise<StapeFunnelMetrics> {
  const period = await getAlignedPeriod();

  try {
    if (!getBigQueryConfig()) {
      return emptyMetrics(period.label);
    }

    const { client, config } = getBigQueryClient();
    const table = eventsFromSql(config);
    const [rows] = await client.query({
      location: config.location,
      params: { startMs: period.startMs, endMs: period.endMs },
      query: `
        WITH events AS (
          SELECT
            CONCAT(IFNULL(client_id, ''), '|', IFNULL(ga_session_id, '')) AS session_key,
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
        )
        SELECT
          (SELECT COUNT(*) FROM session_channels) AS sessions,
          (SELECT COUNTIF(channel = 'Facebook / Meta Ads') FROM session_channels) AS facebook_sessions,
          (SELECT COUNT(DISTINCT session_key) FROM events WHERE event_name = 'page_view') AS landing_sessions,
          (SELECT COUNT(DISTINCT session_key) FROM events WHERE event_name = 'add_to_cart') AS add_to_cart_sessions,
          (SELECT COUNT(DISTINCT session_key) FROM events WHERE event_name = 'begin_checkout') AS checkout_sessions,
          (SELECT COUNT(*) FROM unique_orders) AS purchases,
          (SELECT IFNULL(SUM(revenue), 0) FROM unique_orders) AS purchase_revenue
      `,
    });

    const row = (rows[0] ?? {}) as Record<string, unknown>;
    const sessions = toNumber(row.sessions);
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
      facebookSessions,
      landingSessions,
      addToCartSessions,
      checkoutSessions,
      purchases,
      purchaseRevenue,
      steps: [
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
          label: "Purchase",
          count: purchases,
        },
      ],
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
