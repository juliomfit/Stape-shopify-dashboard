import { overviewPeriodLabel, startDateIso } from "@/lib/period";
import { getSelectedRangeDays } from "@/lib/period-server";
import { shopifyGraphql } from "@/lib/shopify/client";
import { isShopifyConfigured } from "@/lib/shopify/config";
import type {
  ShopifyOrder,
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
          id: string;
          name: string;
          createdAt: string;
          displayFinancialStatus: string | null;
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
          id
          name
          createdAt
          displayFinancialStatus
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

function emptyMetrics(days: number): ShopifyOverviewMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel: overviewPeriodLabel(days),
    revenue: null,
    orders: null,
    products: [],
    topProducts: [],
    recentOrders: [],
    orderPoints: [],
  };
}

export async function getShopifyOverviewMetrics(): Promise<ShopifyOverviewMetrics> {
  const days = await getSelectedRangeDays();

  if (!isShopifyConfigured()) {
    return emptyMetrics(days);
  }

  const query = `created_at:>=${startDateIso(days)}`;

  try {
    let cursor: string | null = null;
    let hasNextPage = true;
    let pages = 0;
    let shopName = "";
    let currencyCode = "USD";
    let ordersCount: number | null = null;
    let revenue = 0;
    const recentOrders: ShopifyOrder[] = [];
    const orderPoints: { createdAt: string; amount: number }[] = [];
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
        const order = edge.node;
        const itemCount = order.lineItems.edges.reduce(
          (total, item) => total + item.node.quantity,
          0,
        );

        revenue += Number(order.currentTotalPriceSet.shopMoney.amount);
        orderPoints.push({
          createdAt: order.createdAt,
          amount: Number(order.currentTotalPriceSet.shopMoney.amount),
        });

        if (recentOrders.length < 25) {
          recentOrders.push({
            id: order.id,
            name: order.name,
            createdAt: order.createdAt,
            financialStatus: order.displayFinancialStatus || "UNKNOWN",
            itemCount,
            total: {
              amount: Number(order.currentTotalPriceSet.shopMoney.amount),
              currencyCode: order.currentTotalPriceSet.shopMoney.currencyCode,
            },
          });
        }

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
      periodLabel: overviewPeriodLabel(days),
      revenue: { amount: revenue, currencyCode },
      orders: ordersCount,
      products,
      topProducts: products.slice(0, 5),
      recentOrders,
      orderPoints,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load Shopify data.";

    return {
      ...emptyMetrics(days),
      status: { state: "error", message },
    };
  }
}
