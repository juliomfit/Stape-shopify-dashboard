import type { StapeConnectionStatus, TrafficSource } from "@/lib/stape/types";

export type TrackingField = {
  label: string;
  filled: number;
  total: number;
  needed: boolean;
};

export type AttributionMetrics = {
  status: StapeConnectionStatus;
  periodLabel: string;
  firstTouch: TrafficSource[];
  lastTouch: TrafficSource[];
  tracking: TrackingField[];
  hasPurchaseEvents: boolean;
};
