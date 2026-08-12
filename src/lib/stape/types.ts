export type StapeConnectionStatus =
  | { state: "not_configured" }
  | { state: "connected"; projectId: string }
  | { state: "error"; message: string };

export type TrafficSource = {
  source: string;
  sessions: number;
};

export type StapeTrafficMetrics = {
  status: StapeConnectionStatus;
  periodLabel: string;
  sessions: number | null;
  users: number | null;
  events: number | null;
  sources: TrafficSource[];
};
