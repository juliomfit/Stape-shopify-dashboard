import type { StapeConnectionStatus, TrafficSource } from "@/lib/stape/types";

export type TrackingField = {
  label: string;
  filled: number;
  total: number;
  needed: boolean;
};

export type ChannelContribution = {
  source: string;
  orders: number;
  revenue: number;
};

export type JourneyTouch = {
  /** Unix epoch milliseconds. */
  ts: number;
  channel: string;
};

export type AttributedOrder = {
  transactionId: string;
  revenue: number;
  firstNonDirect: string;
  lastNonDirect: string;
  lastClick: string;
  personKey: string;
  /** Unix epoch milliseconds of the purchase event. */
  purchaseTs: number;
  /** Ordered touch list (oldest first) within the attribution lookback. */
  touches: JourneyTouch[];
};

export type IdentityStats = {
  purchases: number;
  purchasesWithPerson: number;
  uniquePeople: number;
  uniqueBrowsers: number;
  crossDevicePeople: number;
};

export type AttributionMetrics = {
  status: StapeConnectionStatus;
  periodLabel: string;
  lookbackDays: number;
  attributedOrders: number;
  attributedRevenue: number;
  firstTouch: TrafficSource[];
  lastTouch: TrafficSource[];
  firstNonDirect: ChannelContribution[];
  lastNonDirect: ChannelContribution[];
  lastClick: ChannelContribution[];
  linear: ChannelContribution[];
  orders: AttributedOrder[];
  identity: IdentityStats;
  tracking: TrackingField[];
  hasPurchaseEvents: boolean;
  gaps: string[];
};
