import { friendlyGa4Error, formatGa4Date, getGa4Config } from "@/lib/ads/ga4-config";
import { ga4AccessToken, runGa4Report } from "@/lib/ads/ga4-client";
import { addDaysYmd } from "@/lib/ads/providers/chunk";
import { getDashboardPeriod } from "@/lib/period";
import { getSelectedPeriod } from "@/lib/period-server";
import {
  insertRows,
  isPlatformBqReady,
  runPlatformQuery,
} from "@/lib/platform/bq";
import { platformTable } from "@/lib/platform/config";
import { finishSyncRun, startSyncRun } from "@/lib/platform/sync-runs";

const MAX_DAYS = 93;

async function selectedOrDefaultPeriod() {
  try {
    return await getSelectedPeriod();
  } catch {
    return getDashboardPeriod("7d");
  }
}

function clampPeriod(startDate: string, endDate: string) {
  const today = getDashboardPeriod("today").startDate;
  const end = endDate > today ? today : endDate;
  const minStart = addDaysYmd(end, -(MAX_DAYS - 1));
  return {
    startDate: startDate < minStart ? minStart : startDate,
    endDate: end,
  };
}

async function ensureGa4Tables() {
  const metrics = platformTable("raw_ga4_metrics");
  const sources = platformTable("raw_ga4_sources");
  const breakdowns = platformTable("raw_ga4_breakdowns");
  if (!metrics || !sources || !breakdowns) {
    return;
  }
  await runPlatformQuery(`
    CREATE TABLE IF NOT EXISTS ${metrics} (
      date STRING,
      sessions FLOAT64,
      purchases FLOAT64,
      purchase_revenue FLOAT64,
      engaged_sessions FLOAT64,
      engagement_rate FLOAT64,
      bounce_rate FLOAT64,
      avg_session_seconds FLOAT64,
      new_users FLOAT64,
      active_users FLOAT64,
      add_to_carts FLOAT64,
      checkouts FLOAT64,
      views FLOAT64,
      property_id STRING,
      stream_id STRING,
      synced_at TIMESTAMP,
      source_payload STRING
    )
  `);
  await runPlatformQuery(`
    ALTER TABLE ${metrics}
    ADD COLUMN IF NOT EXISTS engaged_sessions FLOAT64,
    ADD COLUMN IF NOT EXISTS engagement_rate FLOAT64,
    ADD COLUMN IF NOT EXISTS bounce_rate FLOAT64,
    ADD COLUMN IF NOT EXISTS avg_session_seconds FLOAT64,
    ADD COLUMN IF NOT EXISTS new_users FLOAT64,
    ADD COLUMN IF NOT EXISTS active_users FLOAT64,
    ADD COLUMN IF NOT EXISTS add_to_carts FLOAT64,
    ADD COLUMN IF NOT EXISTS checkouts FLOAT64,
    ADD COLUMN IF NOT EXISTS views FLOAT64,
    ADD COLUMN IF NOT EXISTS stream_id STRING
  `);
  await runPlatformQuery(`
    CREATE TABLE IF NOT EXISTS ${sources} (
      date STRING,
      source STRING,
      medium STRING,
      campaign STRING,
      sessions FLOAT64,
      purchases FLOAT64,
      purchase_revenue FLOAT64,
      property_id STRING,
      stream_id STRING,
      synced_at TIMESTAMP
    )
  `);
  await runPlatformQuery(`
    CREATE TABLE IF NOT EXISTS ${breakdowns} (
      date STRING,
      kind STRING,
      label STRING,
      sessions FLOAT64,
      purchases FLOAT64,
      purchase_revenue FLOAT64,
      extra FLOAT64,
      property_id STRING,
      stream_id STRING,
      synced_at TIMESTAMP
    )
  `);
}

async function replaceWindow(table: string, startDate: string, endDate: string, propertyId: string) {
  const fq = platformTable(table);
  if (!fq) {
    return;
  }
  try {
    await runPlatformQuery(
      `DELETE FROM ${fq}
       WHERE property_id = @propertyId
         AND date BETWEEN @startDate AND @endDate`,
      { propertyId, startDate, endDate },
    );
  } catch {
    // Streaming buffer: inserts still land; readers pick latest synced_at.
  }
}

export async function ingestGa4() {
  const ga4 = getGa4Config();
  const period = await selectedOrDefaultPeriod();
  const window = clampPeriod(period.startDate, period.endDate);
  const run = await startSyncRun({
    source: "ga4",
    syncType: "data_api",
    lookbackStart: window.startDate,
    lookbackEnd: window.endDate,
  });
  if (!ga4) {
    return finishSyncRun(run, {
      status: "failed",
      error_message: "GA4_PROPERTY_ID is not set.",
    });
  }

  const notes: string[] = [];
  try {
    const token = await ga4AccessToken();
    const syncedAt = new Date().toISOString();
    const daily = await runGa4Report({
      token,
      startDate: window.startDate,
      endDate: window.endDate,
      dimensions: ["date"],
      metrics: ["sessions", "ecommercePurchases", "purchaseRevenue"],
      limit: 120,
    });
    const extraByDate = new Map<string, number[]>();
    try {
      const extra = await runGa4Report({
        token,
        startDate: window.startDate,
        endDate: window.endDate,
        dimensions: ["date"],
        metrics: [
          "engagedSessions",
          "engagementRate",
          "bounceRate",
          "averageSessionDuration",
          "newUsers",
          "activeUsers",
          "addToCarts",
          "checkouts",
          "screenPageViews",
        ],
        limit: 120,
        optional: true,
      });
      for (const row of extra) {
        extraByDate.set(formatGa4Date(row.dimensions[0] || window.startDate), row.metrics);
      }
    } catch (error) {
      notes.push(
        `engagement: ${error instanceof Error ? error.message : "failed"}`,
      );
    }

    const metricRows = daily.map((row) => {
      const date = formatGa4Date(row.dimensions[0] || window.startDate);
      const extra = extraByDate.get(date) || [];
      return {
        date,
        sessions: row.metrics[0] || 0,
        purchases: row.metrics[1] || 0,
        purchase_revenue: row.metrics[2] || 0,
        engaged_sessions: extra[0] || 0,
        engagement_rate: extra[1] || 0,
        bounce_rate: extra[2] || 0,
        avg_session_seconds: extra[3] || 0,
        new_users: extra[4] || 0,
        active_users: extra[5] || 0,
        add_to_carts: extra[6] || 0,
        checkouts: extra[7] || 0,
        views: extra[8] || 0,
        property_id: ga4.propertyId,
        stream_id: ga4.streamId,
        synced_at: syncedAt,
        source_payload: JSON.stringify(row),
      };
    });

    let sourceRows: Record<string, unknown>[] = [];
    try {
      sourceRows = (
        await runGa4Report({
          token,
          startDate: window.startDate,
          endDate: window.endDate,
          dimensions: ["date", "sessionSource", "sessionMedium", "sessionCampaignName"],
          metrics: ["sessions", "ecommercePurchases", "purchaseRevenue"],
          limit: 500,
        })
      ).map((row) => ({
        date: formatGa4Date(row.dimensions[0] || window.startDate),
        source: row.dimensions[1] || "(direct)",
        medium: row.dimensions[2] || "(none)",
        campaign: row.dimensions[3] || "(not set)",
        sessions: row.metrics[0] || 0,
        purchases: row.metrics[1] || 0,
        purchase_revenue: row.metrics[2] || 0,
        property_id: ga4.propertyId,
        stream_id: ga4.streamId,
        synced_at: syncedAt,
      }));
    } catch (error) {
      notes.push(
        `sources: ${error instanceof Error ? error.message : "failed"}`,
      );
    }

    const breakdownKinds: {
      kind: string;
      dimensions: string[];
      metrics: string[];
      optional?: boolean;
    }[] = [
      { kind: "device", dimensions: ["date", "deviceCategory"], metrics: ["sessions"] },
      { kind: "country", dimensions: ["date", "country"], metrics: ["sessions"] },
      { kind: "landing", dimensions: ["date", "landingPage"], metrics: ["sessions"] },
      {
        kind: "search_term",
        dimensions: ["date", "sessionManualTerm"],
        metrics: ["sessions"],
        optional: true,
      },
      {
        kind: "search_console",
        dimensions: ["date", "searchTerm"],
        metrics: ["sessions"],
        optional: true,
      },
      {
        kind: "google_ads_campaign",
        dimensions: ["date", "sessionGoogleAdsCampaignName"],
        metrics: ["sessions", "advertiserAdCost"],
        optional: true,
      },
    ];

    const breakdownRows: Record<string, unknown>[] = [];
    for (const spec of breakdownKinds) {
      try {
        const rows = await runGa4Report({
          token,
          startDate: window.startDate,
          endDate: window.endDate,
          dimensions: spec.dimensions,
          metrics: spec.metrics,
          limit: 80,
          optional: spec.optional,
        });
        for (const row of rows) {
          breakdownRows.push({
            date: formatGa4Date(row.dimensions[0] || window.startDate),
            kind: spec.kind,
            label: row.dimensions[1] || "(not set)",
            sessions: row.metrics[0] || 0,
            purchases: 0,
            purchase_revenue: 0,
            extra: row.metrics[1] || 0,
            property_id: ga4.propertyId,
            stream_id: ga4.streamId,
            synced_at: syncedAt,
          });
        }
      } catch (error) {
        notes.push(
          `${spec.kind}: ${error instanceof Error ? error.message : "failed"}`,
        );
      }
    }

    if (isPlatformBqReady()) {
      try {
        await ensureGa4Tables();
      } catch (error) {
        notes.push(
          `ensure tables: ${error instanceof Error ? error.message : "failed"}`,
        );
      }
      await replaceWindow("raw_ga4_metrics", window.startDate, window.endDate, ga4.propertyId);
      await replaceWindow("raw_ga4_sources", window.startDate, window.endDate, ga4.propertyId);
      await replaceWindow("raw_ga4_breakdowns", window.startDate, window.endDate, ga4.propertyId);
      await insertRows("raw_ga4_metrics", metricRows);
      await insertRows("raw_ga4_sources", sourceRows);
      await insertRows("raw_ga4_breakdowns", breakdownRows);
    } else {
      notes.push("Platform BigQuery not ready; sync recorded without warehouse rows.");
    }

    const inserted = metricRows.length + sourceRows.length + breakdownRows.length;
    return finishSyncRun(run, {
      status: notes.length ? "partial" : "completed",
      records_inserted: inserted,
      lookback_start: window.startDate,
      lookback_end: window.endDate,
      error_message: notes.length ? notes.join(" · ").slice(0, 2500) : undefined,
      metadata: JSON.stringify({
        propertyId: ga4.propertyId,
        streamId: ga4.streamId || null,
        measurementId: ga4.measurementId || null,
        notes,
      }),
    });
  } catch (error) {
    return finishSyncRun(run, {
      status: "failed",
      error_message: friendlyGa4Error(
        error instanceof Error ? error.message : "GA4 sync failed",
      ),
    });
  }
}
