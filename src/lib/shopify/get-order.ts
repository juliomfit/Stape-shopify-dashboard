import { shopifyGraphql } from "@/lib/shopify/client";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { firstTouchChannel, parseFirstTouch } from "@/lib/shopify/first-touch";
import { shopMoneyAmount, transactionFees } from "@/lib/shopify/money";
import type { ShopifyOrder } from "@/lib/shopify/types";

type LastVisit = {
  landingPage: string | null;
  referrerUrl: string | null;
  source: string | null;
  sourceType: string | null;
  utmParameters: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  } | null;
};

type OrderNode = {
  id: string;
  name: string;
  createdAt: string;
  legacyResourceId: string | null;
  displayFinancialStatus: string | null;
  currentTotalPriceSet: {
    shopMoney: { amount: string; currencyCode: string };
  };
  currentSubtotalPriceSet?: {
    shopMoney: { amount: string; currencyCode: string };
  } | null;
  lineItems: {
    edges: {
      node: {
        quantity: number;
        originalTotalSet?: {
          shopMoney: { amount: string; currencyCode: string };
        };
      };
    }[];
  };
  transactions?: {
    kind?: string | null;
    status?: string | null;
    gateway?: string | null;
    fees?: { amount?: { amount?: string | null } | null; type?: string | null }[] | null;
  }[] | null;
  customAttributes: { key: string; value: string | null }[];
  customer: {
    id: string;
    numberOfOrders: string | number | null;
  } | null;
  customerJourneySummary?: {
    lastVisit: LastVisit | null;
  } | null;
};

export type ShopifyLastTouch = {
  landingPage: string;
  referrerUrl: string;
  source: string;
  sourceType: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
};

export type ShopifyOrderDetail = ShopifyOrder & {
  isNew: boolean | null;
  shopifyLastTouch: ShopifyLastTouch | null;
};

const ORDER_FIELDS = `
  id
  name
  createdAt
  legacyResourceId
  displayFinancialStatus
  currentTotalPriceSet {
    shopMoney { amount currencyCode }
  }
  customAttributes { key value }
  customer { id numberOfOrders }
  transactions(first: 50) {
    kind
    status
    gateway
    fees {
      amount { amount currencyCode }
      type
    }
  }
  lineItems(first: 50) {
    edges {
      node {
        quantity
        originalTotalSet { shopMoney { amount currencyCode } }
      }
    }
  }
`;

function mapOrder(node: OrderNode): ShopifyOrderDetail {
  const attributes = (node.customAttributes || []).map((attribute) => ({
    key: attribute.key,
    value: attribute.value || "",
  }));
  const firstTouch = parseFirstTouch(attributes);
  const lastVisit = node.customerJourneySummary?.lastVisit || null;
  const itemCount = node.lineItems.edges.reduce(
    (total, item) => total + item.node.quantity,
    0,
  );
  const currency = node.currentTotalPriceSet.shopMoney.currencyCode;
  const gross = node.lineItems.edges.reduce(
    (total, item) => total + shopMoneyAmount(item.node.originalTotalSet),
    0,
  );
  const { processingFees, refundFees } = transactionFees(node.transactions);

  return {
    id: node.id,
    name: node.name,
    createdAt: node.createdAt,
    financialStatus: node.displayFinancialStatus || "UNKNOWN",
    itemCount,
    total: {
      amount: Number(node.currentTotalPriceSet.shopMoney.amount),
      currencyCode: currency,
    },
    gross: { amount: gross, currencyCode: currency },
    processingFees:
      processingFees === null
        ? null
        : { amount: processingFees, currencyCode: currency },
    refundFees:
      refundFees === null ? null : { amount: refundFees, currencyCode: currency },
    legacyId: node.legacyResourceId || node.id.split("/").pop() || null,
    firstTouch,
    firstTouchChannel: firstTouchChannel(firstTouch),
    customAttributes: attributes,
    isNew: node.customer ? Number(node.customer.numberOfOrders ?? 0) <= 1 : null,
    shopifyLastTouch: lastVisit
      ? {
          landingPage: lastVisit.landingPage || "",
          referrerUrl: lastVisit.referrerUrl || "",
          source: lastVisit.source || "",
          sourceType: lastVisit.sourceType || "",
          utmSource: lastVisit.utmParameters?.source || "",
          utmMedium: lastVisit.utmParameters?.medium || "",
          utmCampaign: lastVisit.utmParameters?.campaign || "",
        }
      : null,
  };
}

export async function getShopifyOrder(
  legacyId: string,
): Promise<ShopifyOrderDetail | null> {
  if (!isShopifyConfigured()) {
    return null;
  }

  const id = `gid://shopify/Order/${legacyId.replace(/^#/, "")}`;

  try {
    const data = await shopifyGraphql<{ order: OrderNode | null }>(
      `query OrderDetail($id: ID!) { order(id: $id) { ${ORDER_FIELDS}
        customerJourneySummary {
          lastVisit {
            landingPage referrerUrl source sourceType
            utmParameters { source medium campaign content term }
          }
        }
      } }`,
      { id },
    );
    return data.order ? mapOrder(data.order) : null;
  } catch {
    const data = await shopifyGraphql<{ order: OrderNode | null }>(
      `query OrderDetail($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`,
      { id },
    );
    return data.order ? mapOrder(data.order) : null;
  }
}
