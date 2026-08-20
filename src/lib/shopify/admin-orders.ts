import { shopifyGraphql } from "@/lib/shopify/client";
import type { ShopifyGraphqlOrderNode, ShopifyOrderRecord } from "@/lib/shopify/order-record";
import { mapGraphqlOrderToRecord } from "@/lib/shopify/order-record";

const ORDERS_PER_PAGE = 100;
export const SHOPIFY_MAX_PAGES = 100;

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
      node: ShopifyGraphqlOrderNode;
    }[];
  };
};

const MONEY_SET = `
  shopMoney {
    amount
    currencyCode
  }
`;

export const SHOPIFY_ORDERS_QUERY = `
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
            displayName
            numberOfOrders
          }
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

export const SHOPIFY_ORDER_BY_ID_QUERY = `
  query OneOrder($id: ID!) {
    shop { name currencyCode }
    order(id: $id) {
      id
      name
      createdAt
      legacyResourceId
      customAttributes { key value }
      displayFinancialStatus
      currentTotalPriceSet { ${MONEY_SET} }
      currentSubtotalPriceSet { ${MONEY_SET} }
      currentTotalDiscountsSet { ${MONEY_SET} }
      currentShippingPriceSet { ${MONEY_SET} }
      currentTotalTaxSet { ${MONEY_SET} }
      totalRefundedSet { ${MONEY_SET} }
      transactions(first: 50) {
        kind status gateway
        fees { amount { amount currencyCode } type }
      }
      customer { id createdAt displayName numberOfOrders }
      lineItems(first: 250) {
        edges {
          node {
            title quantity
            originalTotalSet { ${MONEY_SET} }
            discountedTotalSet { ${MONEY_SET} }
            product { id title }
          }
        }
      }
    }
  }
`;

export type ShopifyOrderFetchResult = {
  records: ShopifyOrderRecord[];
  truncated: boolean;
  shopName: string;
  reportedOrderCount: number | null;
};

export async function fetchShopifyOrderRecords(
  query: string,
): Promise<ShopifyOrderFetchResult> {
  let cursor: string | null = null;
  let hasNextPage = true;
  let pages = 0;
  let shopName = "";
  let currencyCode = "USD";
  let ordersCount: number | null = null;
  const records: ShopifyOrderRecord[] = [];

  while (hasNextPage && pages < SHOPIFY_MAX_PAGES) {
    const data: OrdersPage = await shopifyGraphql<OrdersPage>(SHOPIFY_ORDERS_QUERY, {
      query,
      cursor,
    });
    shopName = data.shop.name;
    currencyCode = data.shop.currencyCode;
    ordersCount = data.ordersCount?.count ?? ordersCount;
    for (const edge of data.orders.edges) {
      records.push(mapGraphqlOrderToRecord(edge.node, shopName, currencyCode));
    }
    hasNextPage = data.orders.pageInfo.hasNextPage;
    cursor = data.orders.pageInfo.endCursor;
    pages += 1;
  }

  return {
    records,
    truncated: hasNextPage,
    shopName,
    reportedOrderCount: ordersCount,
  };
}

export async function fetchShopifyOrderByGid(
  gid: string,
): Promise<ShopifyOrderRecord | null> {
  type OneOrderPage = {
    shop: { name: string; currencyCode: string };
    order: ShopifyGraphqlOrderNode | null;
  };
  const data = await shopifyGraphql<OneOrderPage>(SHOPIFY_ORDER_BY_ID_QUERY, { id: gid });
  if (!data.order) return null;
  return mapGraphqlOrderToRecord(data.order, data.shop.name, data.shop.currencyCode);
}
