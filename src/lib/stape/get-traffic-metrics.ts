import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { overviewPeriodLabel } from "@/lib/period";
import { getSelectedRangeDays } from "@/lib/period-server";
import { getBigQueryClient } from "@/lib/stape/client";
import { getBigQueryConfig, tableId } from "@/lib/stape/config";
import type { StapeTrafficMetrics, TrafficSource } from "@/lib/stape/types";

const CHANNELS = [
  "Google Ads",
  "Facebook / Meta Ads",
  "Google Organic",
  "Meta Organic",
  "Direct",
  "Other",
] as const;

type TotalsRow = {
  events: number;
  users: number;
  sessions: number;
};

type SourceRow = {
  source: string;
  sessions: number;
};

function emptyMetrics(days: number): StapeTrafficMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel: overviewPeriodLabel(days),
    sessions: null,
    users: null,
    events: null,
    sources: [],
    eventCounts: [],
  };
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function withAllChannels(rows: SourceRow[]): TrafficSource[] {
  const counts = new Map(rows.map((row) => [row.source, toNumber(row.sessions)]));

  return CHANNELS.map((source) => ({
    source,
    sessions: counts.get(source) ?? 0,
  }));
}

export async function getStapeTrafficMetrics(): Promise<StapeTrafficMetrics> {
  const days = await getSelectedRangeDays();

  try {
    if (!getBigQueryConfig()) {
      return emptyMetrics(days);
    }

    const period = await getAlignedPeriod();
    const { client, config } = getBigQueryClient();
    const table = tableId(config);
    const queryOptions = { location: config.location };
    const timeFilter = `timestamp >= @startMs`;
    const timeParams = { startMs: period.startMs };

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
        WHERE ${timeFilter}
      `,
      params: timeParams,
    });

    const [sources] = await client.query({
      ...queryOptions,
      query: `
        WITH hits AS (
          SELECT
            CONCAT(IFNULL(client_id, ''), '|', IFNULL(ga_session_id, '')) AS session_key,
            timestamp,
            LOWER(IFNULL(page_location, '')) AS page_location,
            LOWER(IFNULL(page_referrer, '')) AS page_referrer,
            IFNULL(gclid, '') AS gclid,
            IFNULL(fbclid, '') AS fbclid,
            IFNULL(fbc, '') AS fbc,
            LOWER(IFNULL(source, '')) AS utm_source,
            LOWER(IFNULL(medium, '')) AS utm_medium
          FROM ${table}
          WHERE ${timeFilter}
        ),
        first_hit AS (
          SELECT * EXCEPT (rn)
          FROM (
            SELECT
              hits.*,
              ROW_NUMBER() OVER (PARTITION BY session_key ORDER BY timestamp) AS rn
            FROM hits
          )
          WHERE rn = 1
        )
        SELECT
          CASE
            WHEN gclid != ''
              OR page_location LIKE '%gclid=%'
              OR page_location LIKE '%wbraid=%'
              OR page_location LIKE '%gbraid=%'
              OR (
                utm_source LIKE '%google%'
                AND utm_medium IN ('cpc', 'ppc', 'paid', 'paidsearch')
              )
              THEN 'Google Ads'
            WHEN fbclid != ''
              OR fbc != ''
              OR page_location LIKE '%fbclid=%'
              OR (
                utm_source IN ('facebook', 'fb', 'ig', 'instagram', 'meta')
                AND utm_medium IN ('cpc', 'ppc', 'paid', 'paidsocial', 'social')
              )
              THEN 'Facebook / Meta Ads'
            WHEN page_referrer LIKE '%google.'
              OR page_referrer LIKE '%google.com%'
              THEN 'Google Organic'
            WHEN page_referrer LIKE '%facebook%'
              OR page_referrer LIKE '%instagram%'
              OR page_referrer LIKE '%l.facebook%'
              THEN 'Meta Organic'
            WHEN page_referrer = ''
              OR (
                page_location != ''
                AND STRPOS(page_referrer, NET.HOST(page_location)) > 0
              )
              THEN 'Direct'
            ELSE 'Other'
          END AS source,
          COUNT(*) AS sessions
        FROM first_hit
        GROUP BY 1
        ORDER BY sessions DESC
      `,
      params: timeParams,
    });

    const totalsRow = (totals[0] ?? {}) as TotalsRow;

    const [eventRows] = await client.query({
      ...queryOptions,
      query: `
        SELECT
          event_name AS eventName,
          COUNT(*) AS events,
          COUNT(
            DISTINCT CONCAT(
              IFNULL(client_id, ''),
              '|',
              IFNULL(ga_session_id, '')
            )
          ) AS sessions
        FROM ${table}
        WHERE ${timeFilter}
          AND event_name IS NOT NULL
        GROUP BY event_name
      `,
      params: timeParams,
    });

    return {
      status: { state: "connected", projectId: config.projectId },
      periodLabel: period.label,
      events: toNumber(totalsRow.events),
      users: toNumber(totalsRow.users),
      sessions: toNumber(totalsRow.sessions),
      sources: withAllChannels(sources as SourceRow[]),
      eventCounts: (eventRows as { eventName: string; events: number; sessions: number }[]).map(
        (row) => ({
          eventName: row.eventName,
          events: toNumber(row.events),
          sessions: toNumber(row.sessions),
        }),
      ),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Stape data.";

    return {
      ...emptyMetrics(days),
      status: { state: "error", message },
    };
  }
}
