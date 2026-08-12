export type Money = {
  amount: number;
  currencyCode: string;
};

export type ShopifyConnectionStatus =
  | { state: "not_configured" }
  | { state: "connected"; shopName: string }
  | { state: "error"; message: string };

export type TopProduct = {
  title: string;
  quantity: number;
};

export type ShopifyOverviewMetrics = {
  status: ShopifyConnectionStatus;
  periodLabel: string;
  revenue: Money | null;
  orders: number | null;
  topProducts: TopProduct[];
};
