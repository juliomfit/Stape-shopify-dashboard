import { OVERVIEW_DAYS, overviewPeriodLabel } from "@/lib/period";
import { getBigQueryClient } from "@/lib/stape/client";
import { getBigQueryConfig, tableId } from "@/lib/stape/config";
import type { StapeTrafficMetrics } from "@/lib/stape/types";

type TotalsRow = {
  events: number;
  users: number;
  sessions: number;
};

type SourceRow = {
  source: string;
  sessions: number;
};

function emptyMetrics(): StapeTrafficMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel: overviewPeriodLabel(),
    sessions: null,
    users: null,
    events: null,
    sources: [],
  };
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

export async function getStapeTrafficMetrics(): Promise<StapeTrafficMetrics> {
  try {
    if (!getBigQueryConfig()) {
      return emptyMetrics();
    }

    const { client, config } = getBigQueryClient();
    const table = tableId(config);
    const queryOptions = { location: config.location };

    const [totals] = await client.query({
      ...queryOptions,
      query: `
        SELECT
          COUNT(*) AS events,
          COUNT(DISTINCT client_id) AS users,
          COUNT(
            DISTINCT CONCAT(
              IFNULL(client_id, ''),
              '|',
              IFNULL(ga_session_id, '')
            )
          ) AS sessions
        FROM ${table}
        WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY))
      `,
      params: { days: OVERVIEW_DAYS },
    });

    const [sources] = await client.query({
      ...queryOptions,
      query: `
        SELECT
          CASE
            WHEN gclid IS NOT NULL AND gclid != '' THEN 'Google Ads'
            WHEN (fbclid IS NOT NULL AND fbclid != '')
              OR (fbc IS NOT NULL AND fbc != '') THEN 'Facebook / Meta'
            WHEN page_referrer LIKE '%google.' THEN 'Google Organic'
            WHEN page_referrer LIKE '%facebook%'
              OR page_referrer LIKE '%instagram%'
              OR page_referrer LIKE '%fbclid%' THEN 'Meta Organic'
            WHEN page_referrer IS NULL OR page_referrer = '' THEN 'Direct / unknown'
            ELSE 'Other'
          END AS source,
          COUNT(
            DISTINCT CONCAT(
              IFNULL(client_id, ''),
              '|',
              IFNULL(ga_session_id, '')
            )
          ) AS sessions
        FROM ${table}
        WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY))
        GROUP BY 1
        ORDER BY sessions DESC
      `,
      params: { days: OVERVIEW_DAYS },
    });

    const totalsRow = (totals[0] ?? {}) as TotalsRow;
    const sourceRows = (sources as SourceRow[]).map((row) => ({
      source: row.source,
      sessions: toNumber(row.sessions),
    }));

    return {
      status: { state: "connected", projectId: config.projectId },
      periodLabel: overviewPeriodLabel(),
      events: toNumber(totalsRow.events),
      users: toNumber(totalsRow.users),
      sessions: toNumber(totalsRow.sessions),
      sources: sourceRows.filter((row) => row.sessions > 0),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Stape data.";

    return {
      ...emptyMetrics(),
      status: { state: "error", message },
    };
  }
}
