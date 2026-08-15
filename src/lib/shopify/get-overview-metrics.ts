import { cache } from "react";
import { shopifyOrdersQuery, type DashboardPeriod } from "@/lib/period";
import { getSelectedPeriod } from "@/lib/period-server";
import { shopifyGraphql } from "@/lib/shopify/client";
import { isShopifyConfigured } from "@/lib/shopify/config";
import {
  firstTouchChannel,
  parseFirstTouch,
} from "@/lib/shopify/first-touch";
import { journeyMismatch, JOURNEY_GRAPHQL, parseShopifyJourney } from "@/lib/shopify/journey";
import {
  shopMoneyAmount,
  transactionFees,
  type OrderTransactionNode,
} from "@/lib/shopify/money";
import type {
  ProductChannelMix,
  ShopifyOrder,
  ShopifyOverviewMetrics,
  TopProduct,
} from "@/lib/shopify/types";

const ORDERS_PER_PAGE = 100;
const MAX_PAGES = 20;

type MoneySet = {
  shopMoney: {
    amount: string;
    currencyCode: string;
  };
};

type OrdersPage = {
  shop: {
    name: string;
    currencyCode: string;
  };
  ordersCount: {
    count: number;
  } | null;
  orders: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    edges: {
        node: {
          id: string;
          name: string;
          createdAt: string;
          displayFinancialStatus: string | null;
          currentTotalPriceSet: MoneySet;
          currentSubtotalPriceSet: MoneySet;
          currentTotalDiscountsSet: MoneySet;
          currentShippingPriceSet: MoneySet;
          currentTotalTaxSet: MoneySet;
          totalRefundedSet: MoneySet;
          transactions: OrderTransactionNode[] | null;
          customer: {
            id: string;
            createdAt: string;
            numberOfOrders: string | number | null;
          } | null;
          customerJourneySummary?: {
            ready?: boolean | null;
            daysToConversion?: number | null;
            customerOrderIndex?: number | null;
            firstVisit?: import("@/lib/shopify/journey").ShopifyVisitInput | null;
            lastVisit?: import("@/lib/shopify/journey").ShopifyVisitInput | null;
          } | null;
          legacyResourceId: string | null;
          customAttributes: { key: string; value: string | null }[];
          lineItems: {
          edges: {
            node: {
              title: string;
              quantity: number;
              originalTotalSet: MoneySet;
              discountedTotalSet: MoneySet;
              product: {
                id: string;
                title: string;
              } | null;
            };
          }[];
        };
      };
    }[];
  };
};

const MONEY_SET = `
  shopMoney {
    amount
    currencyCode
  }
`;

const ORDERS_QUERY = `
  query OverviewOrders($query: String!, $cursor: String) {
    shop {
      name
      currencyCode
    }
    ordersCount(query: $query) {
      count
    }
    orders(first: ${ORDERS_PER_PAGE}, query: $query, sortKey: CREATED_AT, reverse: true, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          legacyResourceId
          customAttributes {
            key
            value
          }
          displayFinancialStatus
          currentTotalPriceSet { ${MONEY_SET} }
          currentSubtotalPriceSet { ${MONEY_SET} }
          currentTotalDiscountsSet { ${MONEY_SET} }
          currentShippingPriceSet { ${MONEY_SET} }
          currentTotalTaxSet { ${MONEY_SET} }
          totalRefundedSet { ${MONEY_SET} }
          transactions(first: 50) {
            kind
            status
            gateway
            fees {
              amount { amount currencyCode }
              type
            }
          }
          customer {
            id
            createdAt
            numberOfOrders
          }
          ${JOURNEY_GRAPHQL}
          lineItems(first: 250) {
            edges {
              node {
                title
                quantity
                originalTotalSet { ${MONEY_SET} }
                discountedTotalSet { ${MONEY_SET} }
                product {
                  id
                  title
                }
              }
            }
          }
        }
      }
    }
  }
`;

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
  };
}

export async function getShopifyOverviewMetrics(): Promise<ShopifyOverviewMetrics> {
  return getShopifyOverviewForPeriod(await getSelectedPeriod());
}

const loadOverviewCached = cache(async (key: string, serialized: string) => {
  void key;
  return loadShopifyOverview(JSON.parse(serialized) as DashboardPeriod);
});

export async function getShopifyOverviewForPeriod(
  period: DashboardPeriod,
): Promise<ShopifyOverviewMetrics> {
  return loadOverviewCached(
    `${period.startMs}:${period.endMs}`,
    JSON.stringify(period),
  );
}

async function loadShopifyOverview(
  period: DashboardPeriod,
): Promise<ShopifyOverviewMetrics> {
  if (!isShopifyConfigured()) {
    return emptyMetrics(period.label);
  }

  const query = shopifyOrdersQuery(period);

  try {
    let cursor: string | null = null;
    let hasNextPage = true;
    let pages = 0;
    let shopName = "";
    let currencyCode = "USD";
    let ordersCount: number | null = null;
    let revenue = 0;
    let newCustomerOrders = 0;
    let returningCustomerOrders = 0;
    let guestOrders = 0;
    let newCustomerRevenue = 0;
    let returningCustomerRevenue = 0;
    const recentOrders: ShopifyOrder[] = [];
    const orderPoints: ShopifyOverviewMetrics["orderPoints"] = [];
    const productTotals = new Map<
      string,
      { title: string; quantity: number; revenue: number }
    >();
    const channelMix = new Map<
      string,
      { quantity: number; revenue: number }
    >();

    while (hasNextPage && pages < MAX_PAGES) {
      const data: OrdersPage = await shopifyGraphql<OrdersPage>(ORDERS_QUERY, {
        query,
        cursor,
      });

      shopName = data.shop.name;
      currencyCode = data.shop.currencyCode;
      ordersCount = data.ordersCount?.count ?? ordersCount;

      for (const edge of data.orders.edges) {
        const order = edge.node;
        const created = new Date(order.createdAt).getTime();
        if (created < period.startMs || created >= period.endMs) {
          continue;
        }

        const itemCount = order.lineItems.edges.reduce(
          (total, item) => total + item.node.quantity,
          0,
        );
        const gross = order.lineItems.edges.reduce(
          (total, item) => total + shopMoneyAmount(item.node.originalTotalSet),
          0,
        );
        const amount = shopMoneyAmount(order.currentTotalPriceSet);
        const subtotal = shopMoneyAmount(order.currentSubtotalPriceSet);
        const discounts = shopMoneyAmount(order.currentTotalDiscountsSet);
        const shipping = shopMoneyAmount(order.currentShippingPriceSet);
        const tax = shopMoneyAmount(order.currentTotalTaxSet);
        const refunded = shopMoneyAmount(order.totalRefundedSet);
        const { processingFees, refundFees } = transactionFees(
          order.transactions,
        );
        const currency =
          order.currentTotalPriceSet.shopMoney?.currencyCode || currencyCode;
        const customer = order.customer;
        const isGuest = !customer;
        const isNew = customer
          ? Number(customer.numberOfOrders ?? 0) <= 1
          : null;

        const legacyId =
          order.legacyResourceId || order.id.split("/").pop() || null;
        const customerId = customer?.id.split("/").pop() || null;

        const attributes = (order.customAttributes || []).map((attribute) => ({
          key: attribute.key,
          value: attribute.value || "",
        }));
        const firstTouch = parseFirstTouch(attributes);
        const channel = firstTouchChannel(firstTouch);
        const journey = parseShopifyJourney(order.customerJourneySummary);
        const mismatch = journeyMismatch(journey, channel);

        revenue += amount;
        orderPoints.push({
          createdAt: order.createdAt,
          amount,
          gross,
          subtotal,
          discounts,
          shipping,
          tax,
          refunded,
          processingFees,
          refundFees,
          isNew,
          isGuest,
          legacyId,
          customerId,
          firstTouch,
          firstTouchChannel: channel,
          journey,
          journeyMismatch: mismatch,
        });

        if (isGuest) {
          guestOrders += 1;
        } else if (isNew) {
          newCustomerOrders += 1;
          newCustomerRevenue += amount;
        } else {
          returningCustomerOrders += 1;
          returningCustomerRevenue += amount;
        }

        recentOrders.push({
          id: order.id,
          name: order.name,
          createdAt: order.createdAt,
          financialStatus: order.displayFinancialStatus || "UNKNOWN",
          itemCount,
          total: {
            amount,
            currencyCode: currency,
          },
          gross: { amount: gross, currencyCode: currency },
          processingFees:
            processingFees === null
              ? null
              : { amount: processingFees, currencyCode: currency },
          refundFees:
            refundFees === null
              ? null
              : { amount: refundFees, currencyCode: currency },
          legacyId,
          firstTouch,
          firstTouchChannel: channel,
          customAttributes: attributes,
          journey,
          journeyMismatch: mismatch,
        });

        for (const lineItem of order.lineItems.edges) {
          const product = lineItem.node.product;
          const title = product?.title || lineItem.node.title;
          const id = product?.id || title;
          const current = productTotals.get(id) ?? {
            title,
            quantity: 0,
            revenue: 0,
          };

          current.quantity += lineItem.node.quantity;
          current.revenue += shopMoneyAmount(
            lineItem.node.discountedTotalSet,
          );
          current.title = title;
          productTotals.set(id, current);

          const mix = channelMix.get(channel) ?? { quantity: 0, revenue: 0 };
          mix.quantity += lineItem.node.quantity;
          mix.revenue += shopMoneyAmount(lineItem.node.discountedTotalSet);
          channelMix.set(channel, mix);
        }
      }

      hasNextPage = data.orders.pageInfo.hasNextPage;
      cursor = data.orders.pageInfo.endCursor;
      pages += 1;
    }

    const products: TopProduct[] = [...productTotals.entries()]
      .map(([id, item]) => ({
        id,
        title: item.title,
        quantity: item.quantity,
        revenue: { amount: item.revenue, currencyCode },
      }))
      .sort((a, b) => b.revenue.amount - a.revenue.amount || b.quantity - a.quantity);

    const productChannelMix: ProductChannelMix[] = [...channelMix.entries()]
      .map(([channel, item]) => ({
        channel,
        quantity: item.quantity,
        revenue: item.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity);

    return {
      status: { state: "connected", shopName },
      periodLabel: period.label,
      revenue: { amount: revenue, currencyCode },
      orders: orderPoints.length,
      products,
      topProducts: products.slice(0, 5),
      recentOrders,
      orderPoints,
      truncated: hasNextPage,
      reportedOrderCount: ordersCount,
      newCustomerOrders,
      returningCustomerOrders,
      guestOrders,
      newCustomerRevenue,
      returningCustomerRevenue,
      productChannelMix,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load Shopify data.";

    return {
      ...emptyMetrics(period.label),
      status: { state: "error", message },
    };
  }
}
