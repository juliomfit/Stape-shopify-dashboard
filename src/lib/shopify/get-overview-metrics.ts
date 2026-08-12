import { OVERVIEW_DAYS, overviewPeriodLabel } from "@/lib/period";
import { shopifyGraphql } from "@/lib/shopify/client";
import { isShopifyConfigured } from "@/lib/shopify/config";
import type {
  ShopifyOverviewMetrics,
  TopProduct,
} from "@/lib/shopify/types";

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
                discountedTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
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

function startDateIso(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function emptyMetrics(): ShopifyOverviewMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel: overviewPeriodLabel(),
    revenue: null,
    orders: null,
    products: [],
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
    const productTotals = new Map<
      string,
      { title: string; quantity: number; revenue: number }
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
        revenue += Number(edge.node.currentTotalPriceSet.shopMoney.amount);

        for (const lineItem of edge.node.lineItems.edges) {
          const product = lineItem.node.product;
          const title = product?.title || lineItem.node.title;
          const id = product?.id || title;
          const current = productTotals.get(id) ?? {
            title,
            quantity: 0,
            revenue: 0,
          };

          current.quantity += lineItem.node.quantity;
          current.revenue += Number(
            lineItem.node.discountedTotalSet.shopMoney.amount,
          );
          current.title = title;
          productTotals.set(id, current);
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

    return {
      status: { state: "connected", shopName },
      periodLabel: overviewPeriodLabel(),
      revenue: { amount: revenue, currencyCode },
      orders: ordersCount,
      products,
      topProducts: products.slice(0, 5),
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
