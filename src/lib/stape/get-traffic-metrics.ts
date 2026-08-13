import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { getBigQueryClient } from "@/lib/stape/client";
import {
  ATTRIBUTION_CHANNELS,
  CHANNEL_SQL,
  ORGANIC_CHANNELS,
  PAID_CHANNELS,
} from "@/lib/stape/channel-sql";
import { eventsFromSql, getBigQueryConfig } from "@/lib/stape/config";
import type { StapeTrafficMetrics, TrafficSource } from "@/lib/stape/types";

type TotalsRow = {
  events: number;
  users: number;
  sessions: number;
  pageviews: number;
};

type SourceRow = {
  source: string;
  sessions: number;
};

function emptyMetrics(periodLabel: string): StapeTrafficMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel,
    sessions: null,
    users: null,
    events: null,
    pageviews: null,
    sources: [],
    paidSources: [],
    organicSources: [],
    eventCounts: [],
  };
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function withAllChannels(rows: SourceRow[]): TrafficSource[] {
  const counts = new Map(rows.map((row) => [row.source, toNumber(row.sessions)]));

  return ATTRIBUTION_CHANNELS.map((source) => ({
    source,
    sessions: counts.get(source) ?? 0,
  }));
}

export async function getStapeTrafficMetrics(): Promise<StapeTrafficMetrics> {
  const period = await getAlignedPeriod();

  try {
    if (!getBigQueryConfig()) {
      return emptyMetrics(period.label);
    }

    const { client, config } = getBigQueryClient();
    const table = eventsFromSql(config);
    const queryOptions = { location: config.location };
    const timeParams = { startMs: period.startMs, endMs: period.endMs };

    const [totals] = await client.query({
      ...queryOptions,
      query: `
        WITH events AS (
          SELECT
            CONCAT(IFNULL(client_id, ''), '|', IFNULL(ga_session_id, '')) AS session_key,
            client_id,
            LOWER(IFNULL(event_name, '')) AS event_name
          FROM ${table}
          WHERE timestamp >= @startMs AND timestamp < @endMs
        )
        SELECT
          COUNT(*) AS events,
          COUNT(DISTINCT IF(session_key != '|', client_id, NULL)) AS users,
          (SELECT COUNT(*) FROM (
            SELECT session_key
            FROM events
            WHERE session_key != '|'
            GROUP BY session_key
          )) AS sessions,
          COUNTIF(event_name = 'page_view') AS pageviews
        FROM events
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
            IFNULL(gbraid, '') AS gbraid,
            IFNULL(wbraid, '') AS wbraid,
            IFNULL(dclid, '') AS dclid,
            IFNULL(fbclid, '') AS fbclid,
            IFNULL(fbc, '') AS fbc,
            IFNULL(ttclid, '') AS ttclid,
            IFNULL(msclkid, '') AS msclkid
          FROM ${table}
          WHERE timestamp >= @startMs AND timestamp < @endMs
        ),
        first_hit AS (
          SELECT * EXCEPT (rn)
          FROM (
            SELECT
              hits.*,
              ROW_NUMBER() OVER (PARTITION BY session_key ORDER BY timestamp) AS rn
            FROM hits
            WHERE session_key != '|'
          )
          WHERE rn = 1
        )
        SELECT
          ${CHANNEL_SQL} AS source,
          COUNT(*) AS sessions
        FROM first_hit
        GROUP BY 1
        ORDER BY sessions DESC
      `,
      params: timeParams,
    });

    const totalsRow = (totals[0] ?? {}) as TotalsRow;
    const allSources = withAllChannels(sources as SourceRow[]);

    const [eventRows] = await client.query({
      ...queryOptions,
      query: `
        SELECT
          event_name AS eventName,
          COUNT(*) AS events,
          COUNT(
            DISTINCT IF(
              CONCAT(IFNULL(client_id, ''), '|', IFNULL(ga_session_id, '')) != '|',
              CONCAT(IFNULL(client_id, ''), '|', IFNULL(ga_session_id, '')),
              NULL
            )
          ) AS sessions
        FROM ${table}
        WHERE timestamp >= @startMs AND timestamp < @endMs
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
      pageviews: toNumber(totalsRow.pageviews),
      sources: allSources,
      paidSources: allSources.filter((row) =>
        (PAID_CHANNELS as readonly string[]).includes(row.source),
      ),
      organicSources: allSources.filter((row) =>
        (ORGANIC_CHANNELS as readonly string[]).includes(row.source),
      ),
      eventCounts: (
        eventRows as { eventName: string; events: number; sessions: number }[]
      ).map((row) => ({
        eventName: row.eventName,
        events: toNumber(row.events),
        sessions: toNumber(row.sessions),
      })),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Stape data.";

    return {
      ...emptyMetrics(period.label),
      status: { state: "error", message },
    };
  }
}
