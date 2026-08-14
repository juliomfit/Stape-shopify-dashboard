import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { InfoPanel } from "@/components/dashboard/InfoPanel";
import { SpendCoveragePanel } from "@/components/dashboard/SpendCoveragePanel";
import { TrackingHealth } from "@/components/dashboard/TrackingHealth";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { Header } from "@/components/layout/Header";
import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { listSpendCoverage } from "@/lib/ads/spend-paste";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getStapeFunnelMetrics } from "@/lib/stape/get-funnel-metrics";
import { getBigQueryConfig } from "@/lib/stape/config";
import { WarehouseQualityPanel } from "@/components/dashboard/WarehouseQualityPanel";
import { AttributionAdminCompareTable } from "@/components/dashboard/AttributionAdminCompareTable";
import { JourneyQualityPanel } from "@/components/dashboard/JourneyQualityPanel";
import { buildAttributionCompare } from "@/lib/shopify/compare";
import { getWarehouseMetrics } from "@/lib/warehouse/get-warehouse-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Data quality",
};

export default async function DataQualityPage() {
  const [shopify, funnel, attribution, period, spendCoverage, warehouse] =
    await Promise.all([
    getShopifyOverviewMetrics("full"),
    getStapeFunnelMetrics(),
    getAttributionMetrics(),
    getAlignedPeriod(),
    listSpendCoverage(),
    getWarehouseMetrics(),
  ]);
  const inRange = shopify.orderPoints.filter((order) => {
    const created = new Date(order.createdAt).getTime();
    return created >= period.startMs && created < period.endMs;
  });
  const adminCompare = buildAttributionCompare(inRange);
  const config = (() => {
    try {
      return getBigQueryConfig();
    } catch {
      return null;
    }
  })();
  const notes = [
    shopify.truncated
      ? `Shopify order fetch stopped at ${shopify.orderPoints.length} of ${shopify.reportedOrderCount ?? "unknown"} orders (250 × 20 pages). Narrow the header dates.`
      : "Shopify order pagination finished for this range (open + closed).",
    config
      ? `BigQuery source is ${config.projectId}.${config.dataset}.${config.table}. Live Stape must be stape_data.dashboard_events, not the 19-row test table.`
      : "BigQuery is not configured.",
    config?.table === "dashboard_events"
      ? "dashboard_events is a view over raw_events_full. If the view is dropped or expires, this dashboard will error until BIGQUERY_TABLE is pointed at a live table."
      : "Using a raw table, not the dashboard_events view.",
    spendCoverage.length === 0
      ? "No Meta or Google spend is saved for any date range. Overview MER/ROAS/CPA/net profit stay — until you paste or import for the header dates."
      : `${spendCoverage.length} saved spend range(s). Changing the header to dates without a matching paste shows “No ad spend saved for these dates.”`,
    "Missing gn_* is Unknown, not Direct. Shop Pay Express often has no storefront script.",
    "Shopify Attribution (Admin) is a 30-day first-click compare. Direct in Admin ≠ Direct here.",
    "Device, country, bounce rate, session duration, and COGS are omitted because those fields are not in Shopify or dashboard_events.",
    "Warehouse attribution reads raw_events_full. X-Stape-User-Id, gn_uid, and hashed_email are not BigQuery columns until the sGTM writer is appended.",
    "dashboard_events expires 2026-10-11. Recreate the view without expiration. raw_events_full partitions expire after 60 days.",
  ];

  return (
    <>
      <Header
        title="Data quality"
        description="Truncation, tracking fill, BigQuery source, and which date ranges have ad spend saved."
      />
      <section className="dash-page">
        <ConnectionStatus
          shopify={shopify.status}
          stape={funnel.status}
        />
        <TruncationNotice
          truncated={shopify.truncated}
          fetched={shopify.orderPoints.length}
          reportedCount={shopify.reportedOrderCount}
        />
        <InfoPanel title="Quality notes" items={notes} />
        <JourneyQualityPanel orders={inRange} />
        <AttributionAdminCompareTable
          data={adminCompare}
          currencyCode={shopify.revenue?.currencyCode || "USD"}
          periodLabel={period.label}
        />
        <SpendCoveragePanel
          rows={spendCoverage}
          currentStart={period.startDate}
          currentEnd={period.endDate}
        />
        <TrackingHealth fields={attribution.tracking} />
        <WarehouseQualityPanel
          quality={warehouse.quality}
          totalOrders={warehouse.orders}
        />
      </section>
    </>
  );
}
