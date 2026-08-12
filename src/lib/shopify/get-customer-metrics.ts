import { shopifyOrdersQuery } from "@/lib/period";
import { getSelectedPeriod } from "@/lib/period-server";
import { shopifyGraphql } from "@/lib/shopify/client";
import { isShopifyConfigured } from "@/lib/shopify/config";
import type {
  CustomerPerformance,
  ShopifyCustomerMetrics,
} from "@/lib/shopify/types";

const ORDERS_PER_PAGE = 100;
const MAX_PAGES = 10;

type CustomerOrdersPage = {
  shop: {
    name: string;
    currencyCode: string;
  };
  orders: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    edges: {
      node: {
        currentTotalPriceSet: {
          shopMoney: {
            amount: string;
            currencyCode: string;
          };
        };
        customer: {
          id: string;
          displayName: string | null;
          createdAt: string;
        } | null;
      };
    }[];
  };
};

const CUSTOMER_ORDERS_QUERY = `
  query CustomerOrders($query: String!, $cursor: String) {
    shop {
      name
      currencyCode
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
          customer {
            id
            displayName
            createdAt
          }
        }
      }
    }
  }
`;

function customerLabel(id: string, displayName: string | null) {
  if (displayName?.trim()) {
    return displayName.trim();
  }

  const shortId = id.split("/").pop() || id;
  return `Customer ${shortId.slice(-6)}`;
}

function emptyMetrics(periodLabel: string): ShopifyCustomerMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel,
    customers: [],
    guestOrders: 0,
  };
}

function friendlyCustomerError(message: string) {
  if (message.toLowerCase().includes("read_customers")) {
    return "Shopify needs the read_customers permission. Add that scope in your Shopify app, release it, then open the app again to approve it.";
  }

  return message;
}

export async function getShopifyCustomerMetrics(): Promise<ShopifyCustomerMetrics> {
  const period = await getSelectedPeriod();

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
    let guestOrders = 0;
    const customerTotals = new Map<
      string,
      {
        name: string;
        orderCount: number;
        spend: number;
        createdAt: string;
      }
    >();

    while (hasNextPage && pages < MAX_PAGES) {
      const data: CustomerOrdersPage = await shopifyGraphql<CustomerOrdersPage>(
        CUSTOMER_ORDERS_QUERY,
        { query, cursor },
      );

      shopName = data.shop.name;
      currencyCode = data.shop.currencyCode;

      for (const edge of data.orders.edges) {
        const order = edge.node;

        if (!order.customer) {
          guestOrders += 1;
          continue;
        }

        const current = customerTotals.get(order.customer.id) ?? {
          name: customerLabel(order.customer.id, order.customer.displayName),
          orderCount: 0,
          spend: 0,
          createdAt: order.customer.createdAt,
        };
        current.orderCount += 1;
        current.spend += Number(order.currentTotalPriceSet.shopMoney.amount);
        current.name = customerLabel(
          order.customer.id,
          order.customer.displayName,
        );
        customerTotals.set(order.customer.id, current);
      }

      hasNextPage = data.orders.pageInfo.hasNextPage;
      cursor = data.orders.pageInfo.endCursor;
      pages += 1;
    }

    const customers: CustomerPerformance[] = [...customerTotals.entries()]
      .map(([id, item]) => ({
        id,
        name: item.name,
        orderCount: item.orderCount,
        spend: { amount: item.spend, currencyCode },
        isNew: new Date(item.createdAt).getTime() >= period.startMs,
      }))
      .sort((a, b) => b.spend.amount - a.spend.amount);

    return {
      status: { state: "connected", shopName },
      periodLabel: period.label,
      customers,
      guestOrders,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load Shopify customer data.";

    return {
      ...emptyMetrics(period.label),
      status: { state: "error", message: friendlyCustomerError(message) },
    };
  }
}
