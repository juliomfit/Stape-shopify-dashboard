import { cache } from "react";
import { cachedLoad, periodCacheKey } from "@/lib/cache/server-data";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { shopifyOrdersQuery, type DashboardPeriod } from "@/lib/period";
import { getSelectedPeriod } from "@/lib/period-server";
import { fetchShopifyOrderRecords } from "@/lib/shopify/admin-orders";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { overviewFromRecords } from "@/lib/shopify/order-record";
import { loadShopifyOverviewFromWarehouse, readShopifyWarehouseCoverage } from "@/lib/shopify/warehouse";
import type { ShopifyOverviewMetrics } from "@/lib/shopify/types";

function emptyMetrics(periodLabel: string): ShopifyOverviewMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel,
    revenue: null,
    orders: null,
    products: [],
    topProducts: [],
    recentOrders: [],
    orderPoints: [],
    truncated: false,
    reportedOrderCount: null,
    newCustomerOrders: 0,
    returningCustomerOrders: 0,
    guestOrders: 0,
    newCustomerRevenue: 0,
    returningCustomerRevenue: 0,
    productChannelMix: [],
    readSource: "none",
  };
}

export async function getShopifyOverviewMetrics(): Promise<ShopifyOverviewMetrics> {
  return getShopifyOverviewForPeriod(await getSelectedPeriod());
}

export const getShopifyOverviewForPeriod = cache(
  async (period: DashboardPeriod): Promise<ShopifyOverviewMetrics> => {
    const coverage = await readShopifyWarehouseCoverage();
    return cachedLoad({
      key: [
        "shopify-overview",
        ...periodCacheKey(period),
        coverage.minDate || "",
        coverage.maxDate || "",
      ],
      tags: [CACHE_TAGS.shopify],
      loader: "shopify_overview",
      period: `${period.startDate}..${period.endDate}`,
      fn: () => loadShopifyOverview(period, coverage),
    });
  },
);

async function loadShopifyOverview(
  period: DashboardPeriod,
  coverage: Awaited<ReturnType<typeof readShopifyWarehouseCoverage>>,
): Promise<ShopifyOverviewMetrics> {
  if (!isShopifyConfigured()) {
    return emptyMetrics(period.label);
  }

  try {
    const warehouse = await loadShopifyOverviewFromWarehouse(period, coverage);
    if (warehouse) {
      return warehouse;
    }

    const fetched = await fetchShopifyOrderRecords(shopifyOrdersQuery(period));
    return overviewFromRecords({
      records: fetched.records,
      periodLabel: period.label,
      startMs: period.startMs,
      endMs: period.endMs,
      shopName: fetched.shopName,
      truncated: fetched.truncated,
      reportedOrderCount: fetched.reportedOrderCount,
      readSource: "admin",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Shopify data.";
    return {
      ...emptyMetrics(period.label),
      status: { state: "error", message },
    };
  }
}
