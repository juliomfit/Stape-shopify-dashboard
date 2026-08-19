/**
 * Join canonical attribution credit to Shopify money truth.
 *
 * Event purchase value is tracking evidence only. Attributed revenue is
 * Shopify currentTotalPriceSet (net after refunds) × credit.
 */

import type { OrderPoint } from "../shopify/types.ts";

export type ShopifyMoneyOrder = Pick<
  OrderPoint,
  "amount" | "isNew" | "refunded" | "legacyId"
>;

export type ShopifyMoneyMatch = {
  shopifyNetRevenue: number | null;
  eventPurchaseValue: number | null;
  moneySource: "shopify" | "unmatched";
  isNewCustomer: boolean | null;
  refunded: number | null;
  legacyId: string | null;
};

export function normalizeOrderId(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  return value.replace(/^#/, "").replace(/^gid:\/\/shopify\/Order\//, "").trim();
}

export function indexShopifyOrders(points: OrderPoint[]) {
  const byId = new Map<string, OrderPoint>();
  for (const point of points) {
    const id = normalizeOrderId(point.legacyId);
    if (id) {
      byId.set(id, point);
    }
  }
  return byId;
}

export function matchShopifyOrder(
  transactionId: string,
  byId: Map<string, OrderPoint>,
): OrderPoint | undefined {
  return byId.get(normalizeOrderId(transactionId));
}

/**
 * Shopify currentTotalPriceSet is already net-after-refund. Full refund → 0.
 * Unmatched orders must not fall back to event purchase value.
 */
export function shopifyMoneyForOrder(input: {
  transactionId: string;
  eventPurchaseValue?: number | null;
  shopifyOrder?: ShopifyMoneyOrder;
}): ShopifyMoneyMatch {
  const eventPurchaseValue =
    input.eventPurchaseValue == null || !Number.isFinite(input.eventPurchaseValue)
      ? null
      : input.eventPurchaseValue;
  const order = input.shopifyOrder;
  if (!order) {
    return {
      shopifyNetRevenue: null,
      eventPurchaseValue,
      moneySource: "unmatched",
      isNewCustomer: null,
      refunded: null,
      legacyId: null,
    };
  }
  return {
    shopifyNetRevenue: order.amount,
    eventPurchaseValue,
    moneySource: "shopify",
    isNewCustomer: order.isNew,
    refunded: order.refunded,
    legacyId: order.legacyId,
  };
}

export function attributedRevenue(shopifyNetRevenue: number | null, credit: number) {
  if (shopifyNetRevenue === null) {
    return null;
  }
  return shopifyNetRevenue * credit;
}

/** Fractional new-customer credit. 0 when the order is not a new customer. */
export function newCustomerCredit(isNewCustomer: boolean | null, credit: number) {
  if (isNewCustomer !== true) {
    return 0;
  }
  return credit;
}
