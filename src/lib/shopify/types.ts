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

export type ShopifyOrder = {
  id: string;
  name: string;
  createdAt: string;
  financialStatus: string;
  itemCount: number;
  total: Money;
};

export type CustomerPerformance = {
  id: string;
  name: string;
  orderCount: number;
  spend: Money;
  isNew: boolean;
};

export type OrderPoint = {
  createdAt: string;
  amount: number;
  isNew: boolean | null;
  isGuest: boolean;
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
  newCustomerOrders: number;
  returningCustomerOrders: number;
  guestOrders: number;
  newCustomerRevenue: number;
  returningCustomerRevenue: number;
};

export type ShopifyCustomerMetrics = {
  status: ShopifyConnectionStatus;
  periodLabel: string;
  customers: CustomerPerformance[];
  guestOrders: number;
};
