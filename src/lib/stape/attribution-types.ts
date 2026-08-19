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
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
  sessionKey?: string | null;
  /** Canonical session touchpoint id. Never transactionId-index. */
  touchpointId?: string | null;
  fbclid?: boolean;
  gclid?: boolean;
};

export type AttributedOrder = {
  transactionId: string;
  /** Shopify currentTotalPriceSet when matched; 0 if unmatched (never event value). */
  revenue: number;
  firstNonDirect: string;
  lastNonDirect: string;
  lastClick: string;
  personKey: string;
  /** Unix epoch milliseconds of the purchase event. */
  purchaseTs: number;
  /** Ordered canonical session touches (oldest first) within the lookback. */
  touches: JourneyTouch[];
  gnUid?: string | null;
  stapeUserId?: string | null;
  shopifyCustomerId?: string | null;
  hashedEmailPresent?: boolean | null;
  clientId?: string | null;
  eventPurchaseValue?: number | null;
  shopifyNetRevenue?: number | null;
  moneySource?: "shopify" | "unmatched";
  isNewCustomer?: boolean | null;
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
