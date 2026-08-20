import { cache } from "react";
import type { DashboardPeriod } from "@/lib/period";
import { getSelectedPeriod } from "@/lib/period-server";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { getShopifyOverviewForPeriod } from "@/lib/shopify/get-overview-metrics";
import { customersFromRecords } from "@/lib/shopify/order-record";
import type { ShopifyCustomerMetrics } from "@/lib/shopify/types";

function emptyMetrics(periodLabel: string): ShopifyCustomerMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel,
    customers: [],
    guestOrders: 0,
    truncated: false,
    fetchedOrders: 0,
  };
}

function friendlyCustomerError(message: string) {
  if (message.toLowerCase().includes("read_customers")) {
    return "Shopify needs the read_customers permission. Add that scope in your Shopify app, release it, then open the app again to approve it.";
  }
  return message;
}

function customersFromOverview(
  overview: Awaited<ReturnType<typeof getShopifyOverviewForPeriod>>,
): ShopifyCustomerMetrics | null {
  if (overview.status.state !== "connected") return null;
  const shopName = overview.status.shopName;
  const records = overview.orderPoints.map((point) => ({
    orderGid: point.legacyId || "",
    orderId: point.legacyId || "",
    orderName: "",
    createdAt: point.createdAt,
    orderDate: point.createdAt.slice(0, 10),
    financialStatus: "UNKNOWN",
    currency: overview.revenue?.currencyCode || "USD",
    netRevenue: point.amount,
    gross: point.gross,
    subtotal: point.subtotal,
    discounts: point.discounts,
    shipping: point.shipping,
    tax: point.tax,
    refunded: point.refunded,
    processingFees: point.processingFees,
    refundFees: point.refundFees,
    customerId: point.customerId,
    customerDisplayName: point.customerDisplayName ?? null,
    customerCreatedAt: null,
    customerOrderNumber: point.lifetimeOrders ?? (point.isNew ? 1 : 2),
    isNew: point.isNew,
    isGuest: point.isGuest,
    firstTouch: point.firstTouch,
    firstTouchChannel: point.firstTouchChannel,
    firstProductTitle: point.firstProductTitle,
    gnUid: point.firstTouch.uid || "",
    customAttributes: [],
    lineItems: [],
    itemCount: 0,
    shopName,
  }));
  return customersFromRecords({
    records,
    periodLabel: overview.periodLabel,
    startMs: 0,
    endMs: Number.MAX_SAFE_INTEGER,
    shopName,
    truncated: overview.truncated,
  });
}

export async function getShopifyCustomerMetrics(): Promise<ShopifyCustomerMetrics> {
  return getShopifyCustomerMetricsForPeriod(await getSelectedPeriod());
}

export const getShopifyCustomerMetricsForPeriod = cache(
  async (period: DashboardPeriod): Promise<ShopifyCustomerMetrics> => {
    return loadShopifyCustomerMetrics(period);
  },
);

async function loadShopifyCustomerMetrics(
  period: DashboardPeriod,
): Promise<ShopifyCustomerMetrics> {
  if (!isShopifyConfigured()) {
    return emptyMetrics(period.label);
  }

  try {
    const overview = await getShopifyOverviewForPeriod(period);
    if (overview.status.state === "error") {
      return {
        ...emptyMetrics(period.label),
        status: {
          state: "error",
          message: friendlyCustomerError(overview.status.message),
        },
      };
    }
    const fromOverview = customersFromOverview(overview);
    if (fromOverview) return fromOverview;
    return emptyMetrics(period.label);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Shopify customer data.";
    return {
      ...emptyMetrics(period.label),
      status: { state: "error", message: friendlyCustomerError(message) },
    };
  }
}
