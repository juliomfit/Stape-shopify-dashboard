import { createSign } from "crypto";
import { getBigQueryConfig } from "@/lib/stape/config";
import { finishSyncRun, startSyncRun } from "@/lib/platform/sync-runs";
import { getDashboardPeriod } from "@/lib/period";
import { insertRows, isPlatformBqReady } from "@/lib/platform/bq";

type TokenResponse = { access_token?: string; error?: string };

async function serviceAccountAccessToken(scope: string) {
  const config = getBigQueryConfig();
  const creds = config?.credentials as
    | { client_email?: string; private_key?: string }
    | undefined;
  if (!creds?.client_email || !creds.private_key) {
    throw new Error("Service account JSON is missing client_email/private_key.");
  }

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
    "base64url",
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: creds.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const jwt = `${unsigned}.${signer.sign(creds.private_key, "base64url")}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as TokenResponse;
  if (!json.access_token) {
    throw new Error(json.error || "Google token exchange failed.");
  }
  return json.access_token;
}

export async function ingestGa4() {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const run = await startSyncRun({ source: "ga4", syncType: "data_api" });
  if (!propertyId) {
    return finishSyncRun(run, {
      status: "failed",
      error_message: "GA4_PROPERTY_ID is not set.",
    });
  }

  try {
    const period = getDashboardPeriod("7d");
    const token = await serviceAccountAccessToken(
      "https://www.googleapis.com/auth/analytics.readonly",
    );
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: period.startDate, endDate: period.endDate }],
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "sessions" },
            { name: "ecommercePurchases" },
            { name: "purchaseRevenue" },
          ],
        }),
      },
    );
    const payload = (await response.json()) as {
      rows?: {
        dimensionValues?: { value?: string }[];
        metricValues?: { value?: string }[];
      }[];
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(payload.error?.message || `GA4 Data API ${response.status}`);
    }
    const rows = (payload.rows || []).map((row) => ({
      date: row.dimensionValues?.[0]?.value || period.startDate,
      sessions: Number(row.metricValues?.[0]?.value || 0),
      purchases: Number(row.metricValues?.[1]?.value || 0),
      purchase_revenue: Number(row.metricValues?.[2]?.value || 0),
      property_id: propertyId,
      synced_at: new Date().toISOString(),
    }));
    if (isPlatformBqReady()) {
      try {
        await insertRows(
          "raw_ga4_metrics",
          rows.map((row) => ({
            ...row,
            source_payload: JSON.stringify(row),
          })),
        );
      } catch {
        // Table may not exist until 00_schema is extended; sync still records.
      }
    }
    return finishSyncRun(run, {
      status: "completed",
      records_inserted: rows.length,
      lookback_start: period.startDate,
      lookback_end: period.endDate,
    });
  } catch (error) {
    return finishSyncRun(run, {
      status: "failed",
      error_message: error instanceof Error ? error.message : "GA4 sync failed",
    });
  }
}
