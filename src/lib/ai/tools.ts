import { getCoreDashboard } from "@/lib/dashboard/core-metrics";
import { getCampaignFacts, getAdFacts, getAdsetFacts, getCreativePerformance, rollupAds, rollupAdsets, rollupCampaigns, totalsFromFacts } from "@/lib/ads/meta-query";
import { getMetaClaimed } from "@/lib/ads/meta";
import { getDataHealth } from "@/lib/platform/health";
import { getBusinessContext } from "@/lib/platform/business-context";
import { listChangeLog } from "@/lib/platform/change-log";
import { listSyncRuns } from "@/lib/platform/sync-runs";
import { runScheduledSync, syncMetaBackfill } from "@/lib/platform/orchestrator";
import { getSelectedPeriod } from "@/lib/period-server";
import { parseYmd } from "@/lib/period";
import { contributionMargin, contributionProfit, newCustomerCpa } from "@/lib/metrics/formulas";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { detectAnomalies } from "@/lib/platform/anomalies";

export type AiTool = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
    additionalProperties: false;
  };
};

export const AI_TOOLS: AiTool[] = [
  {
    name: "get_business_summary",
    description: "Shopify revenue, orders, blended spend, MER, contribution profit for the selected dashboard period.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_meta_summary",
    description: "Meta platform-attributed spend, purchases, ROAS, CPA for the selected period. Not Shopify first-touch.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_campaign_performance",
    description: "Meta campaign rollup for the selected period, highest spend first.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_adset_performance",
    description: "Meta ad set rollup. Optional campaign_id filter.",
    parameters: {
      type: "object",
      properties: { campaign_id: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_creative_performance",
    description: "Meta campaign or creative warehouse rollup for the selected period. Flyweel fills campaign rows; thumbnails only if Graph stored them.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_ad_performance",
    description: "Meta ad rollup. Optional campaign_id or adset_id.",
    parameters: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        adset_id: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_shopify_summary",
    description: "Shopify order and revenue totals for the selected period.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_profit_summary",
    description: "Contribution profit (revenue − fees − ad spend) plus profit after COGS only when every Pacific day in the range has a typed supplier row. Never invents COGS or uses typicalCogs.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_tracking_health",
    description: "Source health plus Shopify vs Stape purchase capture. Does not treat Meta attributed purchases as event delivery.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_anomalies",
    description: "Deterministic period-over-period alerts.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "compare_periods",
    description: "Current dashboard period vs the previous equal-length Pacific window.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "sync_meta",
    description: "Run the production Meta incremental importer (Pacific today + yesterday). Does not call Flyweel from dashboard GET.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "sync_google_ads",
    description: "Record Google spend health (paste/env). Does not call Google Ads API.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "sync_ga4",
    description: "Pull GA4 Data API if GA4_PROPERTY_ID is set.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "reconcile_shopify",
    description: "Mark Shopify as reconciled. Orders still come from live Admin API.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "refresh_analytics",
    description: "Run the hourly bundle: Meta, GA4, Google spend check, Stape health, Shopify reconcile.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "backfill_meta_date_range",
    description: "Backfill Meta insights. Dates must be YYYY-MM-DD, max 93 days, Pacific calendar.",
    parameters: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["start_date", "end_date"],
      additionalProperties: false,
    },
  },
];

function compactRollup(rows: ReturnType<typeof rollupCampaigns>) {
  return rows.slice(0, 25).map((row) => ({
    id: row.id,
    name: row.name,
    spend: row.spend,
    purchases: row.purchases,
    purchaseValue: row.purchaseValue,
    roas: row.roas,
    cpa: row.cpa,
    impressions: row.impressions,
    clicks: row.clicks,
  }));
}

export async function executeAiTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "get_business_summary":
    case "get_shopify_summary":
    case "get_profit_summary":
    case "compare_periods": {
      const data = await getCoreDashboard();
      const profit = contributionProfit({
        totalRevenue: data.alignedShopify.revenue,
        processingFees: data.alignedShopify.processingFees,
        refundFees: data.alignedShopify.refundFees,
        adSpend: data.totalSpend,
      });
      return {
        period: {
          label: data.period.label,
          start: data.period.startDate,
          end: data.period.endDate,
          timezone: data.period.timeZone,
        },
        comparison: data.previous.displayRange,
        shopify_orders: data.shopifyConnected ? data.alignedShopify.orders : null,
        shopify_revenue: data.shopifyConnected ? data.alignedShopify.revenue : null,
        new_customer_orders: data.shopifyConnected
          ? data.alignedShopify.newCustomerOrders
          : null,
        ad_spend: data.totalSpend,
        facebook_spend: data.ads.facebook.spend,
        facebook_spend_kind: data.ads.facebook.claimKind ?? null,
        google_spend: data.ads.google.spend,
        google_spend_kind: data.ads.google.claimKind ?? null,
        mer: data.mer,
        blended_roas: data.blendedRoas,
        blended_cpa: data.cpa,
        new_customer_cpa: newCustomerCpa(
          data.totalSpend,
          data.alignedShopify.newCustomerOrders,
        ),
        contribution_profit: profit,
        contribution_margin: contributionMargin(profit, data.alignedShopify.revenue),
        supplier_cogs: data.cogsRange.cogsForRange,
        cogs_complete: data.cogsRange.complete,
        missing_cogs_dates: data.cogsRange.missingDates,
        profit_after_cogs: data.profitAfterCogs,
        profit_after_cogs_margin: contributionMargin(
          data.profitAfterCogs,
          data.alignedShopify.revenue,
        ),
        note: "Blended cards use the same getPlatformReported as Overview. Meta is platform warehouse when Flyweel ingest exists; Google is paste. contribution_profit excludes COGS. profit_after_cogs is null unless every Pacific day in the range has a typed supplier COGS row. typicalCogs is a target only and is never used. Missing spend or COGS is null, not 0.",
      };
    }
    case "get_meta_summary": {
      const period = await getSelectedPeriod();
      const [claim, facts] = await Promise.all([
        getMetaClaimed(period),
        getCampaignFacts(period),
      ]);
      return {
        label: "platform-attributed",
        period: period.label,
        claimKind: claim.claimKind ?? null,
        spend: claim.spend,
        purchases: claim.purchases,
        revenue: claim.revenue,
        warehouse_totals: facts.length ? totalsFromFacts(facts) : null,
        message: claim.message,
        note: "Same resolver as Overview Meta spend and /meta. Ads Manager matching. Not Shopify gn_* first-touch. Missing spend is null. Today $0 after a successful sync is Flyweel lag.",
      };
    }
    case "get_campaign_performance": {
      const period = await getSelectedPeriod();
      return compactRollup(rollupCampaigns(await getCampaignFacts(period)));
    }
    case "get_adset_performance": {
      const period = await getSelectedPeriod();
      const campaignId = typeof args.campaign_id === "string" ? args.campaign_id : undefined;
      return compactRollup(rollupAdsets(await getAdsetFacts(period, campaignId)));
    }
    case "get_ad_performance": {
      const period = await getSelectedPeriod();
      const rows = await getAdFacts(period, {
        campaignId: typeof args.campaign_id === "string" ? args.campaign_id : undefined,
        adsetId: typeof args.adset_id === "string" ? args.adset_id : undefined,
      });
      return compactRollup(rollupAds(rows));
    }
    case "get_creative_performance": {
      const period = await getSelectedPeriod();
      return (await getCreativePerformance(period)).slice(0, 25);
    }
    case "get_tracking_health": {
      const [health, attribution, data] = await Promise.all([
        getDataHealth(),
        getAttributionMetrics(),
        getCoreDashboard(),
      ]);
      return {
        sources: health.map((row) => ({
          label: row.label,
          status: row.status,
          message: row.message,
        })),
        shopify_orders: data.shopifyConnected ? data.alignedShopify.orders : null,
        stape_purchases: data.stapeConnected ? data.funnel.purchases : null,
        meta_attributed_purchases: data.ads.facebook.purchases,
        note: "Meta attributed purchases are not event-delivery coverage. Compare Shopify vs Stape for capture.",
        stape_fill: attribution.tracking.slice(0, 12),
      };
    }
    case "get_anomalies": {
      const data = await getCoreDashboard();
      const period = data.period;
      const prevFacts = await getCampaignFacts(data.previous);
      const curFacts = await getCampaignFacts(period);
      const cur = totalsFromFacts(curFacts);
      const prev = totalsFromFacts(prevFacts);
      return detectAnomalies({
        revenue: data.shopifyConnected ? data.alignedShopify.revenue : null,
        previousRevenue: data.previousShopify.status.state === "connected"
          ? data.previousAligned.revenue
          : null,
        orders: data.shopifyConnected ? data.alignedShopify.orders : null,
        previousOrders: data.previousShopify.status.state === "connected"
          ? data.previousAligned.orders
          : null,
        spend: data.totalSpend,
        previousSpend: null,
        mer: data.mer,
        previousMer: null,
        cpa: data.cpa,
        previousCpa: null,
        conversion: data.conversion.rate,
        previousConversion: data.previousConversion.rate,
        metaCpa: cur.cpa,
        previousMetaCpa: prev.cpa,
      });
    }
    case "sync_meta":
      return runScheduledSync("meta");
    case "sync_google_ads":
      return runScheduledSync("google_ads");
    case "sync_ga4":
      return runScheduledSync("ga4");
    case "reconcile_shopify":
      return runScheduledSync("shopify");
    case "refresh_analytics":
      return runScheduledSync("all");
    case "backfill_meta_date_range": {
      const start = String(args.start_date || "");
      const end = String(args.end_date || "");
      if (!parseYmd(start) || !parseYmd(end)) {
        return { ok: false, message: "start_date and end_date must be YYYY-MM-DD." };
      }
      if (start > end) {
        return { ok: false, message: "start_date must be on or before end_date." };
      }
      return syncMetaBackfill(start, end);
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

export async function aiSystemPrompt(viewContext?: string) {
  const context = await getBusinessContext();
  const changes = (await listChangeLog()).slice(0, 8);
  const runs = (await listSyncRuns()).slice(0, 6);
  return [
    "You are GoodsNova analytics copilot. Use tools. Do not invent spend, COGS, or orders.",
    "Distinguish observed fact, calculated metric, inference, and recommendation.",
    "Never claim causation from correlation. Never pause ads or change budgets.",
    "First-touch (cart gn_*) is one model on /attribution. Multi-touch OUR attribution is /attribution/overview. Unknown is never Direct.",
    "MER = Shopify revenue ÷ ad spend (same ratio as blended ROAS). Marketing cost ratio = spend ÷ revenue. Do not call both MER.",
    "Blended nCAC = total spend ÷ Shopify new-customer orders. Attributed nCAC = grain spend ÷ fractional new-customer credit. Do not mix.",
    "Missing spend is null (—), never invent $0 CPA. Today $0 after a warehouse sync is real Flyweel lag — say so.",
    `Business: ${context.business}. Product: ${context.primaryProduct}.`,
    `Timezone: ${context.timezone}. Currency: ${context.currency}.`,
    `Targets: CPA ${context.targetCpa ?? "unset"}, MER ${context.targetMer ?? "unset"}, contribution margin ${context.targetContributionMargin ?? "unset"}.`,
    "Typical COGS is a static target only — never copy it into daily profit or invent supplier cost.",
    `Paid channels: ${context.paidChannels}. Conversion: ${context.primaryConversion}.`,
    viewContext ? `Current UI context: ${viewContext}` : "",
    `Recent change log: ${JSON.stringify(changes)}`,
    `Recent syncs: ${JSON.stringify(runs.map((run) => ({ source: run.source, status: run.status, at: run.started_at })))}`,
    `Dashboard period cookie is already applied inside tools via getSelectedPeriod().`,
  ]
    .filter(Boolean)
    .join("\n");
}
