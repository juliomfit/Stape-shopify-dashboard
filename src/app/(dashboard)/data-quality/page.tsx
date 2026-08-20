import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { InfoPanel } from "@/components/dashboard/InfoPanel";
import { SpendCoveragePanel } from "@/components/dashboard/SpendCoveragePanel";
import { TrackingHealth } from "@/components/dashboard/TrackingHealth";
import { IdentityMatchPanel } from "@/components/dashboard/IdentityMatchPanel";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { Header } from "@/components/layout/Header";
import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { listSpendCoverage } from "@/lib/ads/spend-paste";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getStapeFunnelMetrics } from "@/lib/stape/get-funnel-metrics";
import { getBigQueryConfig } from "@/lib/stape/config";
import { WarehouseQualityPanel } from "@/components/dashboard/WarehouseQualityPanel";
import { MetaIngestHealthPanel } from "@/components/dashboard/MetaIngestHealthPanel";
import { getWarehouseMetrics } from "@/lib/warehouse/get-warehouse-metrics";
import { getMetaFactTableCounts } from "@/lib/ads/meta-fact-counts";
import { getMetaConnectionPublic } from "@/lib/ads/meta-credentials";


export const metadata: Metadata = {
  title: "Data quality",
};

export default async function DataQualityPage() {
  const [shopify, funnel, attribution, period, spendCoverage, warehouse, ingestCounts, metaConnection] =
    await Promise.all([
    getShopifyOverviewMetrics(),
    getStapeFunnelMetrics(),
    getAttributionMetrics(),
    getAlignedPeriod(),
    listSpendCoverage(),
    getWarehouseMetrics(),
    getMetaFactTableCounts(),
    getMetaConnectionPublic(),
  ]);
  const config = (() => {
    try {
      return getBigQueryConfig();
    } catch {
      return null;
    }
  })();
  const notes = [
    shopify.truncated
      ? `Shopify order fetch stopped at ${shopify.orderPoints.length} of ${shopify.reportedOrderCount ?? "unknown"} orders (100 × 100 pages). Narrow the header dates or run migration 004 for warehouse history.`
      : "Shopify order pagination finished for this range (open + closed, up to 10,000 orders).",
    config
      ? `BigQuery source is ${config.projectId}.${config.dataset}.${config.table}. Live Stape must be stape_data.dashboard_events, not the 19-row test table.`
      : "BigQuery is not configured.",
    config?.table === "dashboard_events"
      ? "dashboard_events is a view over raw_events_full. If the view is dropped or expires, this dashboard will error until BIGQUERY_TABLE is pointed at a live table."
      : "Using a raw table, not the dashboard_events view.",
    spendCoverage.length === 0
      ? "No Google paste and no Meta warehouse rows for any saved range. Overview MER/ROAS/CPA/net profit stay — until warehouse or paste covers the header dates."
      : `${spendCoverage.length} saved spend range(s). Changing the header to dates without warehouse Meta or a matching Google paste shows —.`,
    "Overview Meta spend prefers goodsnova_platform campaign facts (Flyweel ingest). Paste no longer overrides warehouse. Google Ads is still paste.",
    "Today (Pacific) often has $0 in Flyweel while yesterday has spend. That is shown as $0 after a successful sync, not invented, and not hidden as a broken dashboard.",
    "Missing gn_* is Unknown, not Direct. Shop Pay Express often has no storefront script.",
    "Device, country, bounce rate, session duration, and COGS are omitted because those fields are not in Shopify or dashboard_events.",
    "Warehouse attribution reads raw_events_full. gn_uid, stape_user_id, hashed_email, and shopify_customer_id are BigQuery columns on that table when the sGTM writer fills them. The debugger shows presence, not plaintext email.",
    "dashboard_events previously expired 2026-10-11. Recreate it with bigquery/migrations/2026_08_18_003_dashboard_events_lifecycle.sql. raw_events_full partitions were ~60 days; that migration extends retention. 90-day attribution stays hidden until retained_days ≥ 90.",
    "MER = Shopify revenue ÷ ad spend. Marketing cost ratio = spend ÷ revenue. Unknown ≠ Direct. Assists = middle touches, not Linear.",
    "Meta channel attribution can be valid while campaign mapping is 0%. Exact gn_meta_campaign_id / gn_meta_adset_id / gn_meta_ad_id are HIGH. Campaign-name match is legacy PARTIAL. Adset/ad OUR metrics stay hidden until those IDs exist. Unmapped Meta credit stays visible. Do not fuzzy-map or infer IDs from spend.",
    "Flyweel query_metrics is campaign-grain only (no adset/ad dimensions). meta_adset_insights_daily and meta_ad_insights_daily stay empty. That is not a broken Meta integration and not invented spend. Deterministic ad set/ad attribution needs a source with native Meta child IDs.",
  ];

  return (
    <>
      <Header
        title="Data quality"
        description="Truncation, tracking fill, BigQuery source, and why other pages show —."
      />
      <section className="dash-page gap-6">
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
        <SpendCoveragePanel
          rows={spendCoverage}
          currentStart={period.startDate}
          currentEnd={period.endDate}
        />
        <TrackingHealth fields={attribution.tracking} />
        <IdentityMatchPanel identity={attribution.identity} />
        <WarehouseQualityPanel
          quality={warehouse.quality}
          totalOrders={warehouse.orders}
        />
        <MetaIngestHealthPanel
          providerId={metaConnection.provider}
          counts={ingestCounts}
        />
      </section>
    </>
  );
}
