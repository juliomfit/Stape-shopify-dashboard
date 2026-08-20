import { EMPTY_FIRST_TOUCH, firstTouchChannel, parseFirstTouch, type FirstTouch } from "./first-touch.ts";
import { shopMoneyAmount, transactionFees, type OrderTransactionNode } from "./money.ts";
import { pacificYmd } from "../period.ts";
import type {
  OrderPoint,
  ProductChannelMix,
  ShopifyOrder,
  ShopifyOverviewMetrics,
  TopProduct,
  CustomerPerformance,
  ShopifyCustomerMetrics,
  ShopifyReadSource,
} from "./types.ts";

export type MoneySet = {
  shopMoney: {
    amount: string;
    currencyCode: string;
  };
};

export type ShopifyGraphqlOrderNode = {
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
    createdAt?: string | null;
    displayName?: string | null;
    numberOfOrders: string | number | null;
  } | null;
  legacyResourceId: string | null;
  customAttributes: { key: string; value: string | null }[];
  lineItems: {
    edges: {
      node: {
        title: string;
        quantity: number;
        originalTotalSet: MoneySet;
        discountedTotalSet?: MoneySet;
        product: {
          id: string;
          title: string;
        } | null;
      };
    }[];
  };
};

export type ShopifyLineItemRecord = {
  productId: string;
  title: string;
  quantity: number;
  originalTotal: number;
  discountedTotal: number;
};

export type ShopifyOrderRecord = {
  orderGid: string;
  orderId: string;
  orderName: string;
  createdAt: string;
  orderDate: string;
  financialStatus: string;
  currency: string;
  netRevenue: number;
  gross: number;
  subtotal: number;
  discounts: number;
  shipping: number;
  tax: number;
  refunded: number;
  processingFees: number | null;
  refundFees: number | null;
  customerId: string | null;
  customerDisplayName: string | null;
  customerCreatedAt: string | null;
  customerOrderNumber: number | null;
  isNew: boolean | null;
  isGuest: boolean;
  firstTouch: FirstTouch;
  firstTouchChannel: string;
  firstProductTitle: string | null;
  gnUid: string;
  customAttributes: { key: string; value: string }[];
  lineItems: ShopifyLineItemRecord[];
  itemCount: number;
  shopName: string;
};

function moneyOrZero(set: MoneySet | undefined): number {
  return shopMoneyAmount(set);
}

export function mapGraphqlOrderToRecord(
  order: ShopifyGraphqlOrderNode,
  shopName: string,
  fallbackCurrency: string,
): ShopifyOrderRecord {
  const currency =
    order.currentTotalPriceSet.shopMoney?.currencyCode || fallbackCurrency;
  const customer = order.customer;
  const isGuest = !customer;
  const customerOrderNumber = customer ? Number(customer.numberOfOrders ?? 0) : null;
  const isNew = customer ? Number(customer.numberOfOrders ?? 0) <= 1 : null;
  const attributes = (order.customAttributes || []).map((attribute) => ({
    key: attribute.key,
    value: attribute.value || "",
  }));
  const firstTouch = parseFirstTouch(attributes);
  const channel = firstTouchChannel(firstTouch);
  const { processingFees, refundFees } = transactionFees(order.transactions);
  const lineItems: ShopifyLineItemRecord[] = order.lineItems.edges.map((edge) => {
    const product = edge.node.product;
    const title = product?.title || edge.node.title;
    return {
      productId: product?.id || title,
      title,
      quantity: edge.node.quantity,
      originalTotal: moneyOrZero(edge.node.originalTotalSet),
      discountedTotal: moneyOrZero(edge.node.discountedTotalSet || edge.node.originalTotalSet),
    };
  });
  const itemCount = lineItems.reduce((total, item) => total + item.quantity, 0);
  const gross = lineItems.reduce((total, item) => total + item.originalTotal, 0);
  const orderId = order.legacyResourceId || order.id.split("/").pop() || order.id;

  return {
    orderGid: order.id,
    orderId,
    orderName: order.name,
    createdAt: order.createdAt,
    orderDate: pacificYmd(order.createdAt),
    financialStatus: order.displayFinancialStatus || "UNKNOWN",
    currency,
    netRevenue: moneyOrZero(order.currentTotalPriceSet),
    gross,
    subtotal: moneyOrZero(order.currentSubtotalPriceSet),
    discounts: moneyOrZero(order.currentTotalDiscountsSet),
    shipping: moneyOrZero(order.currentShippingPriceSet),
    tax: moneyOrZero(order.currentTotalTaxSet),
    refunded: moneyOrZero(order.totalRefundedSet),
    processingFees,
    refundFees,
    customerId: customer?.id.split("/").pop() || customer?.id || null,
    customerDisplayName: customer?.displayName?.trim() || null,
    customerCreatedAt: customer?.createdAt || null,
    customerOrderNumber,
    isNew,
    isGuest,
    firstTouch,
    firstTouchChannel: channel,
    firstProductTitle: lineItems[0]?.title || null,
    gnUid: firstTouch.uid || "",
    customAttributes: attributes,
    lineItems,
    itemCount,
    shopName,
  };
}

export function recordToOrderPoint(record: ShopifyOrderRecord): OrderPoint {
  return {
    createdAt: record.createdAt,
    amount: record.netRevenue,
    gross: record.gross,
    subtotal: record.subtotal,
    discounts: record.discounts,
    shipping: record.shipping,
    tax: record.tax,
    refunded: record.refunded,
    processingFees: record.processingFees,
    refundFees: record.refundFees,
    isNew: record.isNew,
    isGuest: record.isGuest,
    legacyId: record.orderId,
    customerId: record.customerId,
    firstTouch: record.firstTouch,
    firstTouchChannel: record.firstTouchChannel,
    firstProductTitle: record.firstProductTitle,
    customerDisplayName: record.customerDisplayName,
    lifetimeOrders: record.customerOrderNumber,
  };
}

export function recordToShopifyOrder(record: ShopifyOrderRecord): ShopifyOrder {
  return {
    id: record.orderGid,
    name: record.orderName,
    createdAt: record.createdAt,
    financialStatus: record.financialStatus,
    itemCount: record.itemCount,
    total: { amount: record.netRevenue, currencyCode: record.currency },
    gross: { amount: record.gross, currencyCode: record.currency },
    processingFees:
      record.processingFees === null
        ? null
        : { amount: record.processingFees, currencyCode: record.currency },
    refundFees:
      record.refundFees === null
        ? null
        : { amount: record.refundFees, currencyCode: record.currency },
    legacyId: record.orderId,
    firstTouch: record.firstTouch,
    firstTouchChannel: record.firstTouchChannel,
    customAttributes: record.customAttributes,
  };
}

export function overviewFromRecords(input: {
  records: ShopifyOrderRecord[];
  periodLabel: string;
  startMs: number;
  endMs: number;
  shopName: string;
  truncated: boolean;
  reportedOrderCount: number | null;
  readSource?: ShopifyReadSource;
}): ShopifyOverviewMetrics {
  const inRange = input.records.filter((record) => {
    const created = new Date(record.createdAt).getTime();
    return created >= input.startMs && created < input.endMs;
  });
  const currency = inRange[0]?.currency || input.records[0]?.currency || "USD";
  let revenue = 0;
  let newCustomerOrders = 0;
  let returningCustomerOrders = 0;
  let guestOrders = 0;
  let newCustomerRevenue = 0;
  let returningCustomerRevenue = 0;
  const productTotals = new Map<string, { title: string; quantity: number; revenue: number }>();
  const channelMix = new Map<string, { quantity: number; revenue: number }>();

  for (const record of inRange) {
    revenue += record.netRevenue;
    if (record.isGuest) {
      guestOrders += 1;
    } else if (record.isNew) {
      newCustomerOrders += 1;
      newCustomerRevenue += record.netRevenue;
    } else {
      returningCustomerOrders += 1;
      returningCustomerRevenue += record.netRevenue;
    }
    for (const line of record.lineItems) {
      const current = productTotals.get(line.productId) ?? {
        title: line.title,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += line.quantity;
      current.revenue += line.discountedTotal;
      current.title = line.title;
      productTotals.set(line.productId, current);
      const mix = channelMix.get(record.firstTouchChannel) ?? { quantity: 0, revenue: 0 };
      mix.quantity += line.quantity;
      mix.revenue += line.discountedTotal;
      channelMix.set(record.firstTouchChannel, mix);
    }
  }

  const products: TopProduct[] = [...productTotals.entries()]
    .map(([id, item]) => ({
      id,
      title: item.title,
      quantity: item.quantity,
      revenue: { amount: item.revenue, currencyCode: currency },
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
    status: { state: "connected", shopName: input.shopName },
    periodLabel: input.periodLabel,
    revenue: { amount: revenue, currencyCode: currency },
    orders: inRange.length,
    products,
    topProducts: products.slice(0, 5),
    recentOrders: inRange.map(recordToShopifyOrder),
    orderPoints: inRange.map(recordToOrderPoint),
    truncated: input.truncated,
    reportedOrderCount: input.reportedOrderCount,
    newCustomerOrders,
    returningCustomerOrders,
    guestOrders,
    newCustomerRevenue,
    returningCustomerRevenue,
    productChannelMix,
    readSource: input.readSource ?? "admin",
  };
}

export function customersFromRecords(input: {
  records: ShopifyOrderRecord[];
  periodLabel: string;
  startMs: number;
  endMs: number;
  shopName: string;
  truncated: boolean;
}): ShopifyCustomerMetrics {
  const inRange = input.records.filter((record) => {
    const created = new Date(record.createdAt).getTime();
    return created >= input.startMs && created < input.endMs;
  });
  const currency = inRange[0]?.currency || "USD";
  let guestOrders = 0;
  const totals = new Map<
    string,
    {
      name: string;
      orderCount: number;
      spend: number;
      numberOfOrders: number;
      lastOrderAt: string | null;
      createdAt: string | null;
    }
  >();

  for (const record of inRange) {
    if (record.isGuest || !record.customerId) {
      guestOrders += 1;
      continue;
    }
    const name =
      record.customerDisplayName ||
      `Customer ${record.customerId.slice(-6)}`;
    const current = totals.get(record.customerId) ?? {
      name,
      orderCount: 0,
      spend: 0,
      numberOfOrders: record.customerOrderNumber ?? 0,
      lastOrderAt: record.createdAt,
      createdAt: record.customerCreatedAt,
    };
    current.orderCount += 1;
    current.spend += record.netRevenue;
    current.name = name;
    current.numberOfOrders = record.customerOrderNumber ?? current.numberOfOrders;
    if (
      !current.lastOrderAt ||
      new Date(record.createdAt).getTime() > new Date(current.lastOrderAt).getTime()
    ) {
      current.lastOrderAt = record.createdAt;
    }
    totals.set(record.customerId, current);
  }

  const customers: CustomerPerformance[] = [...totals.entries()]
    .map(([id, item]) => ({
      id,
      name: item.name,
      orderCount: item.orderCount,
      spend: { amount: item.spend, currencyCode: currency },
      isNew: item.numberOfOrders <= 1,
      lastOrderAt: item.lastOrderAt,
      lifetimeOrders: item.numberOfOrders,
      createdAt: item.createdAt,
    }))
    .sort((a, b) => b.spend.amount - a.spend.amount);

  return {
    status: { state: "connected", shopName: input.shopName },
    periodLabel: input.periodLabel,
    customers,
    guestOrders,
    truncated: input.truncated,
    fetchedOrders: inRange.length,
  };
}

export function emptyFirstTouch(): FirstTouch {
  return { ...EMPTY_FIRST_TOUCH };
}
