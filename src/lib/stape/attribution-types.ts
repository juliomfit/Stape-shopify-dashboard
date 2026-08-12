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
  tracking: TrackingField[];
  hasPurchaseEvents: boolean;
  gaps: string[];
};
