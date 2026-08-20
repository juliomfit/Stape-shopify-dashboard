import { addDaysYmd } from "@/lib/ads/providers/chunk";
import { getDashboardPeriod } from "@/lib/period";
import { fetchShopifyOrderByGid, fetchShopifyOrderRecords } from "@/lib/shopify/admin-orders";
import { expandShopifyWarehouseCoverage, mergeShopifyOrderRecords } from "@/lib/shopify/warehouse";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { SHOPIFY_INCREMENTAL_LOOKBACK_DAYS } from "@/lib/freshness/schedules";

export function shopifyLookbackPeriod(lookbackDays: number) {
  const today = getDashboardPeriod("today");
  const startDate = addDaysYmd(today.startDate, -(Math.max(lookbackDays, 1) - 1));
  return getDashboardPeriod("custom", new Date(), {
    startDate,
    endDate: today.endDate,
  });
}

export function shopifyCreatedAtQuery(lookbackDays: number) {
  const period = shopifyLookbackPeriod(lookbackDays);
  return {
    period,
    query: `created_at:>='${period.startIso}' AND created_at:<'${period.endIso}' AND (status:open OR status:closed)`,
  };
}

export function shopifyUpdatedOnlyQuery(lookbackDays: number) {
  const period = shopifyLookbackPeriod(lookbackDays);
  return `updated_at:>='${period.startIso}' AND created_at:<'${period.startIso}' AND (status:open OR status:closed)`;
}

export async function ingestShopifyIncremental(lookbackDays = SHOPIFY_INCREMENTAL_LOOKBACK_DAYS) {
  if (!isShopifyConfigured()) {
    return {
      ok: false,
      records: 0,
      truncated: false,
      message: "Shopify is not configured.",
    };
  }
  const created = shopifyCreatedAtQuery(lookbackDays);
  const createdFetch = await fetchShopifyOrderRecords(created.query);
  let updatedRecords = createdFetch.records.slice(0, 0);
  try {
    const updatedFetch = await fetchShopifyOrderRecords(shopifyUpdatedOnlyQuery(lookbackDays));
    updatedRecords = updatedFetch.records;
  } catch (error) {
    console.warn("[shopify-ingest] updated_at window failed", error);
  }
  const byId = new Map<string, (typeof createdFetch.records)[number]>();
  for (const record of [...createdFetch.records, ...updatedRecords]) {
    byId.set(record.orderId, record);
  }
  const records = [...byId.values()];
  const merged = await mergeShopifyOrderRecords(records);
  const truncated = createdFetch.truncated;
  if (!merged.tableReady) {
    return {
      ok: false,
      records: 0,
      truncated,
      message:
        "Shopify warehouse table is not available yet. Dashboard keeps using the Admin API fallback.",
    };
  }
  if (!truncated) {
    await expandShopifyWarehouseCoverage(created.period.startDate, created.period.endDate);
  }
  return {
    ok: true,
    records: merged.written,
    truncated,
    message: truncated
      ? "Shopify incremental ingest truncated at the Admin pagination cap. Coverage was not advanced."
      : `Shopify warehouse merged ${merged.written} orders (${lookbackDays}d window).`,
  };
}

export async function upsertShopifyOrderFromWebhook(raw: string) {
  let gid: string | null = null;
  try {
    const payload = JSON.parse(raw) as {
      admin_graphql_api_id?: string;
      id?: number | string;
    };
    gid =
      payload.admin_graphql_api_id ||
      (payload.id ? `gid://shopify/Order/${payload.id}` : null);
  } catch {
    gid = null;
  }
  if (!gid) {
    return { ok: false, message: "Webhook payload had no order id." };
  }
  const record = await fetchShopifyOrderByGid(gid);
  if (!record) {
    return { ok: false, message: "Shopify order not found for webhook id." };
  }
  const merged = await mergeShopifyOrderRecords([record]);
  return { ok: merged.tableReady, message: `Upserted ${record.orderId}` };
}
