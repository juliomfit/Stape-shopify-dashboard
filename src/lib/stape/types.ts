export type StapeConnectionStatus =
  | { state: "not_configured" }
  | { state: "connected"; projectId: string }
  | { state: "error"; message: string };

export type TrafficSource = {
  source: string;
  sessions: number;
};

export type StapeEventCount = {
  eventName: string;
  events: number;
  sessions: number;
};

export type StapeTrafficMetrics = {
  status: StapeConnectionStatus;
  periodLabel: string;
  sessions: number | null;
  users: number | null;
  events: number | null;
  pageviews: number | null;
  sources: TrafficSource[];
  paidSources: TrafficSource[];
  organicSources: TrafficSource[];
  eventCounts: StapeEventCount[];
};
