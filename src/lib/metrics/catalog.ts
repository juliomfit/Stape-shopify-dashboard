/**
 * Governed metric catalog. UI, AI, and docs must cite these formulas.
 * Implementations live in `formulas.ts`. Do not re-derive in React pages.
 */

export const METRIC_CATALOG = {
  revenue: {
    id: "revenue",
    label: "Revenue",
    formula: "Shopify currentTotalPriceSet (net after refunds and discounts)",
  },
  netRevenue: {
    id: "net_revenue",
    label: "Net revenue",
    formula: "Same as Revenue in this product (net-after-refund)",
  },
  adSpend: {
    id: "ad_spend",
    label: "Ad spend",
    formula: "Meta warehouse spend + Google paste/env spend. Null (—) when missing; never fabricated 0.",
  },
  metaSpend: {
    id: "meta_spend",
    label: "Meta spend",
    formula: "goodsnova_platform.meta_campaign_insights_daily (Flyweel). Not gn_* first-touch.",
  },
  googleSpend: {
    id: "google_spend",
    label: "Google spend",
    formula: "Paste/env only. No Google Ads API. Residual gclid is not a Google Ads account.",
  },
  orders: {
    id: "orders",
    label: "Orders",
    formula: "Shopify orders in range with currentTotalPriceSet. Dual GA4+Data Client copies are not extra orders.",
  },
  newCustomers: {
    id: "new_customers",
    label: "New customers",
    formula: "Shopify customer.numberOfOrders <= 1 on the order (order grain).",
  },
  returningCustomers: {
    id: "returning_customers",
    label: "Returning customers",
    formula: "Identified Shopify customers with numberOfOrders > 1.",
  },
  aov: {
    id: "aov",
    label: "AOV",
    formula: "Revenue ÷ orders",
  },
  ourRoas: {
    id: "our_roas",
    label: "Our attributed ROAS",
    formula: "Our attributed revenue ÷ spend for that grain. Null if spend missing.",
  },
  platformRoas: {
    id: "platform_roas",
    label: "Platform ROAS",
    formula: "Platform-reported purchase value ÷ platform spend (Meta Ads Manager / Flyweel).",
  },
  blendedRoas: {
    id: "blended_roas",
    label: "Blended ROAS",
    formula: "Total Shopify revenue ÷ total ad spend",
  },
  mer: {
    id: "mer",
    label: "MER",
    formula: "Total Shopify revenue ÷ total ad spend (same ratio as blended ROAS, labeled MER). Example: $100,000 / $40,000 = 2.5 MER.",
  },
  marketingCostRatio: {
    id: "marketing_cost_ratio",
    label: "Marketing cost ratio",
    formula: "Total ad spend ÷ total Shopify revenue. Formerly mislabeled MER. Example: $40,000 / $100,000 = 40%.",
  },
  blendedNcac: {
    id: "blended_ncac",
    label: "Blended nCAC",
    formula: "Total ad spend ÷ Shopify new-customer orders. Store-wide, not campaign-attributed.",
  },
  attributedNcac: {
    id: "attributed_ncac",
    label: "Attributed nCAC",
    formula: "Channel/campaign spend ÷ fractional attributed new-customer credit. Null when mapping coverage is unvalidated or spend is missing.",
  },
  cpa: {
    id: "cpa",
    label: "CPA",
    formula: "Ad spend ÷ Shopify paid orders (total > $0)",
  },
  grossProfit: {
    id: "gross_profit",
    label: "Gross profit",
    formula: "Net revenue − COGS. Incomplete unless every Pacific day in range has a typed supplier COGS row.",
  },
  contributionProfit: {
    id: "contribution_profit",
    label: "Contribution profit",
    formula: "Net revenue − Shopify Payments fees − ad spend − COGS (only when complete) − shipping expense (only when supplied). Missing inputs make the metric incomplete, not $0.",
  },
  contributionMargin: {
    id: "contribution_margin",
    label: "Contribution margin",
    formula: "Contribution profit ÷ revenue",
  },
  profitRoas: {
    id: "profit_roas",
    label: "Profit ROAS",
    formula: "Contribution profit ÷ ad spend. Can be negative.",
  },
  ltv: {
    id: "ltv",
    label: "LTV",
    formula: "Cumulative Shopify net revenue from first purchase through N days. Immature cohorts are marked, never shown as final.",
  },
  ltvCac: {
    id: "ltv_cac",
    label: "LTV:CAC",
    formula: "Windowed LTV ÷ blended nCAC. Null when CAC is missing.",
  },
  attributionCoverage: {
    id: "attribution_coverage",
    label: "Attribution coverage",
    formula: "Orders with ≥1 credited eligible touch ÷ Shopify (or canonical warehouse) orders. Unattributed stays Unattributed, not Direct.",
  },
  identityMatchRate: {
    id: "identity_match_rate",
    label: "Identity match rate",
    formula: "Purchases with a person key beyond anonymous client_id ÷ purchases",
  },
} as const;

export type MetricCatalogId = keyof typeof METRIC_CATALOG;
