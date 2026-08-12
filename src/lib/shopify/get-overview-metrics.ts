import { shopifyGraphql } from "@/lib/shopify/client";
import { isShopifyConfigured } from "@/lib/shopify/config";
import type {
  ShopifyOverviewMetrics,
  TopProduct,
} from "@/lib/shopify/types";

const OVERVIEW_DAYS = 30;
const ORDERS_PER_PAGE = 100;
const MAX_PAGES = 10;

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
        currentTotalPriceSet: MoneySet;
        lineItems: {
          edges: {
            node: {
              title: string;
              quantity: number;
            };
          }[];
        };
      };
    }[];
  };
};

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
          currentTotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          lineItems(first: 50) {
            edges {
              node {
                title
                quantity
              }
            }
          }
        }
      }
    }
  }
`;

function startDateIso(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function emptyMetrics(): ShopifyOverviewMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel: `Last ${OVERVIEW_DAYS} days`,
    revenue: null,
    orders: null,
    topProducts: [],
  };
}

export async function getShopifyOverviewMetrics(): Promise<ShopifyOverviewMetrics> {
  if (!isShopifyConfigured()) {
    return emptyMetrics();
  }

  const query = `created_at:>=${startDateIso(OVERVIEW_DAYS)}`;

  try {
    let cursor: string | null = null;
    let hasNextPage = true;
    let pages = 0;
    let shopName = "";
    let currencyCode = "USD";
    let ordersCount: number | null = null;
    let revenue = 0;
    const productTotals = new Map<string, number>();

    while (hasNextPage && pages < MAX_PAGES) {
      const data: OrdersPage = await shopifyGraphql<OrdersPage>(ORDERS_QUERY, {
        query,
        cursor,
      });

      shopName = data.shop.name;
      currencyCode = data.shop.currencyCode;
      ordersCount = data.ordersCount?.count ?? ordersCount;

      for (const edge of data.orders.edges) {
        revenue += Number(edge.node.currentTotalPriceSet.shopMoney.amount);

        for (const lineItem of edge.node.lineItems.edges) {
          const title = lineItem.node.title;
          productTotals.set(
            title,
            (productTotals.get(title) ?? 0) + lineItem.node.quantity,
          );
        }
      }

      hasNextPage = data.orders.pageInfo.hasNextPage;
      cursor = data.orders.pageInfo.endCursor;
      pages += 1;
    }

    const topProducts: TopProduct[] = [...productTotals.entries()]
      .map(([title, quantity]) => ({ title, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      status: { state: "connected", shopName },
      periodLabel: `Last ${OVERVIEW_DAYS} days`,
      revenue: { amount: revenue, currencyCode },
      orders: ordersCount,
      topProducts,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load Shopify data.";

    return {
      ...emptyMetrics(),
      status: { state: "error", message },
    };
  }
}
