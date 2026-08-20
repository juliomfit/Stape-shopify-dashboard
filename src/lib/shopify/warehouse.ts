import { getBigQueryClient } from "@/lib/stape/client";
import { getBigQueryConfig } from "@/lib/stape/config";
import { EMPTY_FIRST_TOUCH, type FirstTouch } from "@/lib/shopify/first-touch";
import type { ShopifyLineItemRecord, ShopifyOrderRecord } from "@/lib/shopify/order-record";
import { overviewFromRecords, customersFromRecords } from "@/lib/shopify/order-record";
import type { DashboardPeriod } from "@/lib/period";
import type { ShopifyCustomerMetrics, ShopifyOverviewMetrics } from "@/lib/shopify/types";
import { readShopifyWarehouseCoverage, warehouseCoversPeriod } from "@/lib/shopify/coverage";
import type { ShopifyWarehouseCoverage } from "@/lib/shopify/coverage";

export function shopifyOrdersTableFq(): string | null {
  const config = getBigQueryConfig();
  if (!config) return null;
  const dataset = process.env.BIGQUERY_SHOPIFY_DATASET?.trim() || "analytics";
  return `\`${config.projectId}.${dataset}.fct_shopify_orders\``;
}

export function isMissingTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|does not exist|wasn't found|was not found/i.test(message);
}

const EXTRA_COLUMNS: { name: string; sql: string }[] = [
  { name: "subtotal", sql: "FLOAT64" },
  { name: "refund_fees", sql: "FLOAT64" },
  { name: "financial_status", sql: "STRING" },
  { name: "is_guest", sql: "BOOL" },
  { name: "customer_order_number", sql: "INT64" },
  { name: "customer_display_name", sql: "STRING" },
  { name: "customer_created_at", sql: "TIMESTAMP" },
  { name: "order_gid", sql: "STRING" },
  { name: "shop_name", sql: "STRING" },
  { name: "first_touch_json", sql: "STRING" },
  { name: "line_items_json", sql: "STRING" },
  { name: "custom_attributes_json", sql: "STRING" },
];

export async function ensureShopifyOrdersTable(): Promise<boolean> {
  const table = shopifyOrdersTableFq();
  if (!table) return false;
  const { client, config } = getBigQueryClient();
  try {
    await client.query({
      query: `
        CREATE TABLE IF NOT EXISTS ${table} (
          order_id STRING NOT NULL,
          order_name STRING,
          created_at TIMESTAMP,
          order_date DATE,
          currency STRING,
          net_revenue FLOAT64,
          gross_sales FLOAT64,
          discounts FLOAT64,
          refunds FLOAT64,
          shipping FLOAT64,
          tax FLOAT64,
          processing_fees FLOAT64,
          customer_id STRING,
          is_new_customer BOOL,
          first_touch_channel STRING,
          gn_uid STRING,
          first_product_title STRING,
          ingested_at TIMESTAMP,
          subtotal FLOAT64,
          refund_fees FLOAT64,
          financial_status STRING,
          is_guest BOOL,
          customer_order_number INT64,
          customer_display_name STRING,
          customer_created_at TIMESTAMP,
          order_gid STRING,
          shop_name STRING,
          first_touch_json STRING,
          line_items_json STRING,
          custom_attributes_json STRING
        )
        PARTITION BY order_date
        CLUSTER BY customer_id, first_touch_channel
      `,
      location: config.location,
    });
    for (const column of EXTRA_COLUMNS) {
      try {
        await client.query({
          query: `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column.name} ${column.sql}`,
          location: config.location,
        });
      } catch (error) {
        console.warn("[shopify-warehouse] add column skipped", column.name, error);
      }
    }
    return true;
  } catch (error) {
    if (isMissingTableError(error)) return false;
    console.warn("[shopify-warehouse] ensure table failed", error);
    return false;
  }
}

export function recordToWarehousePayload(record: ShopifyOrderRecord) {
  return {
    order_id: record.orderId,
    order_gid: record.orderGid,
    order_name: record.orderName,
    created_at: record.createdAt,
    order_date: record.orderDate,
    currency: record.currency,
    net_revenue: record.netRevenue,
    gross_sales: record.gross,
    discounts: record.discounts,
    refunds: record.refunded,
    shipping: record.shipping,
    tax: record.tax,
    processing_fees: record.processingFees,
    refund_fees: record.refundFees,
    subtotal: record.subtotal,
    customer_id: record.customerId,
    is_new_customer: record.isNew,
    is_guest: record.isGuest,
    first_touch_channel: record.firstTouchChannel,
    gn_uid: record.gnUid,
    first_product_title: record.firstProductTitle,
    financial_status: record.financialStatus,
    customer_order_number: record.customerOrderNumber,
    customer_display_name: record.customerDisplayName,
    customer_created_at: record.customerCreatedAt,
    shop_name: record.shopName,
    first_touch_json: JSON.stringify(record.firstTouch),
    line_items_json: JSON.stringify(record.lineItems),
    custom_attributes_json: JSON.stringify(record.customAttributes),
  };
}

export async function mergeShopifyOrderRecords(
  records: ShopifyOrderRecord[],
): Promise<{ written: number; tableReady: boolean }> {
  const table = shopifyOrdersTableFq();
  if (!table) return { written: 0, tableReady: false };
  const tableReady = await ensureShopifyOrdersTable();
  if (!tableReady) return { written: 0, tableReady: false };
  if (records.length === 0) return { written: 0, tableReady: true };
  const { client, config } = getBigQueryClient();
  const payload = JSON.stringify(records.map(recordToWarehousePayload));
  await client.query({
    query: `
      MERGE ${table} T
      USING (
        SELECT
          JSON_VALUE(row, '$.order_id') AS order_id,
          JSON_VALUE(row, '$.order_gid') AS order_gid,
          JSON_VALUE(row, '$.order_name') AS order_name,
          TIMESTAMP(JSON_VALUE(row, '$.created_at')) AS created_at,
          DATE(JSON_VALUE(row, '$.order_date')) AS order_date,
          JSON_VALUE(row, '$.currency') AS currency,
          SAFE_CAST(JSON_VALUE(row, '$.net_revenue') AS FLOAT64) AS net_revenue,
          SAFE_CAST(JSON_VALUE(row, '$.gross_sales') AS FLOAT64) AS gross_sales,
          SAFE_CAST(JSON_VALUE(row, '$.discounts') AS FLOAT64) AS discounts,
          SAFE_CAST(JSON_VALUE(row, '$.refunds') AS FLOAT64) AS refunds,
          SAFE_CAST(JSON_VALUE(row, '$.shipping') AS FLOAT64) AS shipping,
          SAFE_CAST(JSON_VALUE(row, '$.tax') AS FLOAT64) AS tax,
          SAFE_CAST(JSON_VALUE(row, '$.processing_fees') AS FLOAT64) AS processing_fees,
          SAFE_CAST(JSON_VALUE(row, '$.refund_fees') AS FLOAT64) AS refund_fees,
          SAFE_CAST(JSON_VALUE(row, '$.subtotal') AS FLOAT64) AS subtotal,
          JSON_VALUE(row, '$.customer_id') AS customer_id,
          CASE JSON_VALUE(row, '$.is_new_customer')
            WHEN 'true' THEN TRUE WHEN 'false' THEN FALSE ELSE NULL END AS is_new_customer,
          CASE JSON_VALUE(row, '$.is_guest')
            WHEN 'true' THEN TRUE WHEN 'false' THEN FALSE ELSE NULL END AS is_guest,
          JSON_VALUE(row, '$.first_touch_channel') AS first_touch_channel,
          JSON_VALUE(row, '$.gn_uid') AS gn_uid,
          JSON_VALUE(row, '$.first_product_title') AS first_product_title,
          JSON_VALUE(row, '$.financial_status') AS financial_status,
          SAFE_CAST(JSON_VALUE(row, '$.customer_order_number') AS INT64) AS customer_order_number,
          JSON_VALUE(row, '$.customer_display_name') AS customer_display_name,
          IF(
            JSON_VALUE(row, '$.customer_created_at') IS NULL
              OR JSON_VALUE(row, '$.customer_created_at') = '',
            NULL,
            TIMESTAMP(JSON_VALUE(row, '$.customer_created_at'))
          ) AS customer_created_at,
          JSON_VALUE(row, '$.shop_name') AS shop_name,
          JSON_VALUE(row, '$.first_touch_json') AS first_touch_json,
          JSON_VALUE(row, '$.line_items_json') AS line_items_json,
          JSON_VALUE(row, '$.custom_attributes_json') AS custom_attributes_json
        FROM UNNEST(JSON_QUERY_ARRAY(PARSE_JSON(@payload))) AS row
      ) S
      ON T.order_id = S.order_id
      WHEN MATCHED THEN UPDATE SET
        order_name = S.order_name,
        created_at = S.created_at,
        order_date = S.order_date,
        currency = S.currency,
        net_revenue = S.net_revenue,
        gross_sales = S.gross_sales,
        discounts = S.discounts,
        refunds = S.refunds,
        shipping = S.shipping,
        tax = S.tax,
        processing_fees = S.processing_fees,
        refund_fees = S.refund_fees,
        subtotal = S.subtotal,
        customer_id = S.customer_id,
        is_new_customer = S.is_new_customer,
        is_guest = S.is_guest,
        first_touch_channel = S.first_touch_channel,
        gn_uid = S.gn_uid,
        first_product_title = S.first_product_title,
        financial_status = S.financial_status,
        customer_order_number = S.customer_order_number,
        customer_display_name = S.customer_display_name,
        customer_created_at = S.customer_created_at,
        order_gid = S.order_gid,
        shop_name = S.shop_name,
        first_touch_json = S.first_touch_json,
        line_items_json = S.line_items_json,
        custom_attributes_json = S.custom_attributes_json,
        ingested_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (
        order_id, order_name, created_at, order_date, currency, net_revenue, gross_sales,
        discounts, refunds, shipping, tax, processing_fees, refund_fees, subtotal, customer_id,
        is_new_customer, is_guest, first_touch_channel, gn_uid, first_product_title,
        financial_status, customer_order_number, customer_display_name, customer_created_at,
        order_gid, shop_name, first_touch_json, line_items_json, custom_attributes_json, ingested_at
      ) VALUES (
        S.order_id, S.order_name, S.created_at, S.order_date, S.currency, S.net_revenue, S.gross_sales,
        S.discounts, S.refunds, S.shipping, S.tax, S.processing_fees, S.refund_fees, S.subtotal, S.customer_id,
        S.is_new_customer, S.is_guest, S.first_touch_channel, S.gn_uid, S.first_product_title,
        S.financial_status, S.customer_order_number, S.customer_display_name, S.customer_created_at,
        S.order_gid, S.shop_name, S.first_touch_json, S.line_items_json, S.custom_attributes_json, CURRENT_TIMESTAMP()
      )
    `,
    params: { payload },
    location: config.location,
  });
  return { written: records.length, tableReady: true };
}

type WarehouseRow = Record<string, unknown>;

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "value" in value) {
    return String((value as { value: string }).value);
  }
  return String(value);
}

function asNumber(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function asBool(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  const raw = asString(value).toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

function parseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function warehouseRowToRecord(row: WarehouseRow): ShopifyOrderRecord {
  const firstTouch = parseJson<FirstTouch>(asString(row.first_touch_json), {
    ...EMPTY_FIRST_TOUCH,
  });
  const lineItems = parseJson<ShopifyLineItemRecord[]>(asString(row.line_items_json), []);
  const customAttributes = parseJson<{ key: string; value: string }[]>(
    asString(row.custom_attributes_json),
    [],
  );
  const isGuest = asBool(row.is_guest);
  const isNew = asBool(row.is_new_customer);
  return {
    orderGid: asString(row.order_gid) || asString(row.order_id),
    orderId: asString(row.order_id),
    orderName: asString(row.order_name),
    createdAt: asString(row.created_at),
    orderDate: asString(row.order_date),
    financialStatus: asString(row.financial_status) || "UNKNOWN",
    currency: asString(row.currency) || "USD",
    netRevenue: asNumber(row.net_revenue),
    gross: asNumber(row.gross_sales),
    subtotal: asNumber(row.subtotal),
    discounts: asNumber(row.discounts),
    shipping: asNumber(row.shipping),
    tax: asNumber(row.tax),
    refunded: asNumber(row.refunds),
    processingFees: asNumberOrNull(row.processing_fees),
    refundFees: asNumberOrNull(row.refund_fees),
    customerId: asString(row.customer_id) || null,
    customerDisplayName: asString(row.customer_display_name) || null,
    customerCreatedAt: asString(row.customer_created_at) || null,
    customerOrderNumber: asNumberOrNull(row.customer_order_number),
    isNew,
    isGuest: isGuest ?? !asString(row.customer_id),
    firstTouch,
    firstTouchChannel: asString(row.first_touch_channel) || "Unknown",
    firstProductTitle: asString(row.first_product_title) || null,
    gnUid: asString(row.gn_uid),
    customAttributes,
    lineItems,
    itemCount: lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0),
    shopName: asString(row.shop_name) || "Shopify",
  };
}

export async function loadShopifyRecordsFromWarehouse(
  period: DashboardPeriod,
  coverage?: ShopifyWarehouseCoverage,
): Promise<ShopifyOrderRecord[] | null> {
  const table = shopifyOrdersTableFq();
  if (!table) return null;
  const resolved = coverage ?? (await readShopifyWarehouseCoverage());
  if (!warehouseCoversPeriod(resolved, period.startDate, period.endDate)) {
    return null;
  }
  try {
    const { client, config } = getBigQueryClient();
    const [rows] = await client.query({
      query: `
        SELECT
          order_id, order_name, created_at, order_date, currency,
          net_revenue, gross_sales, discounts, refunds, shipping, tax, processing_fees,
          customer_id, is_new_customer, first_touch_channel, gn_uid, first_product_title,
          subtotal, refund_fees, financial_status, is_guest, customer_order_number,
          customer_display_name, customer_created_at, order_gid, shop_name,
          first_touch_json, line_items_json, custom_attributes_json
        FROM ${table}
        WHERE order_date >= @startDate AND order_date <= @endDate
      `,
      params: { startDate: period.startDate, endDate: period.endDate },
      location: config.location,
    });
    return (rows as WarehouseRow[]).map(warehouseRowToRecord);
  } catch (error) {
    if (isMissingTableError(error)) return null;
    console.warn("[shopify-warehouse] read failed; using Admin API fallback", error);
    return null;
  }
}

export async function loadShopifyOverviewFromWarehouse(
  period: DashboardPeriod,
  coverage?: ShopifyWarehouseCoverage,
): Promise<ShopifyOverviewMetrics | null> {
  const records = await loadShopifyRecordsFromWarehouse(period, coverage);
  if (!records) return null;
  const shopName = records[0]?.shopName || "Shopify";
  return overviewFromRecords({
    records,
    periodLabel: period.label,
    startMs: period.startMs,
    endMs: period.endMs,
    shopName,
    truncated: false,
    reportedOrderCount: records.length,
  });
}

export async function loadShopifyCustomersFromWarehouse(
  period: DashboardPeriod,
  coverage?: ShopifyWarehouseCoverage,
): Promise<ShopifyCustomerMetrics | null> {
  const records = await loadShopifyRecordsFromWarehouse(period, coverage);
  if (!records) return null;
  const shopName = records[0]?.shopName || "Shopify";
  return customersFromRecords({
    records,
    periodLabel: period.label,
    startMs: period.startMs,
    endMs: period.endMs,
    shopName,
    truncated: false,
  });
}
