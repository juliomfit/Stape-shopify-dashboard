import type { FirstTouch } from "@/lib/shopify/first-touch";

export type Money = {
  amount: number;
  currencyCode: string;
};

export type ShopifyConnectionStatus =
  | { state: "not_configured" }
  | { state: "connected"; shopName: string }
  | { state: "error"; message: string };

export type TopProduct = {
  id: string;
  title: string;
  quantity: number;
  revenue: Money;
};

export type ProductChannelMix = {
  channel: string;
  quantity: number;
  revenue: number;
};

export type ShopifyOrder = {
  id: string;
  name: string;
  createdAt: string;
  financialStatus: string;
  itemCount: number;
  total: Money;
  gross: Money;
  processingFees: Money | null;
  refundFees: Money | null;
  legacyId: string | null;
  firstTouch: FirstTouch;
  firstTouchChannel: string;
  customAttributes: { key: string; value: string }[];
};

export type CustomerPerformance = {
  id: string;
  name: string;
  orderCount: number;
  spend: Money;
  isNew: boolean;
  lastOrderAt: string | null;
  lifetimeOrders: number;
};

export type OrderPoint = {
  createdAt: string;
  amount: number;
  gross: number;
  subtotal: number;
  discounts: number;
  shipping: number;
  tax: number;
  refunded: number;
  processingFees: number | null;
  refundFees: number | null;
  isNew: boolean | null;
  isGuest: boolean;
  legacyId: string | null;
  customerId: string | null;
  firstTouch: FirstTouch;
  firstTouchChannel: string;
};

export type ShopifyOverviewMetrics = {
  status: ShopifyConnectionStatus;
  periodLabel: string;
  revenue: Money | null;
  orders: number | null;
  products: TopProduct[];
  topProducts: TopProduct[];
  recentOrders: ShopifyOrder[];
  orderPoints: OrderPoint[];
  truncated: boolean;
  reportedOrderCount: number | null;
  newCustomerOrders: number;
  returningCustomerOrders: number;
  guestOrders: number;
  newCustomerRevenue: number;
  returningCustomerRevenue: number;
  productChannelMix: ProductChannelMix[];
};

export type ShopifyCustomerMetrics = {
  status: ShopifyConnectionStatus;
  periodLabel: string;
  customers: CustomerPerformance[];
  guestOrders: number;
  truncated: boolean;
  fetchedOrders: number;
};
