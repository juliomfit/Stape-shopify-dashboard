"use client";

import { useMemo, useState } from "react";
import { DailyTrendChart } from "@/components/dashboard/DailyTrendChart";

const OPTIONS = [
  { key: "spend", label: "Spend" },
  { key: "purchase_value", label: "Purchase value" },
  { key: "purchases", label: "Purchases" },
  { key: "roas", label: "ROAS" },
  { key: "cpa", label: "CPA" },
  { key: "cpm", label: "CPM" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
  { key: "frequency", label: "Frequency" },
] as const;

type MetricKey = (typeof OPTIONS)[number]["key"];

export function MetaPerformanceChart({
  days,
  series,
}: {
  days: string[];
  series: Record<MetricKey, number[]>;
}) {
  const [primary, setPrimary] = useState<MetricKey>("spend");
  const [secondary, setSecondary] = useState<MetricKey>("purchase_value");
  const a = useMemo(() => OPTIONS.find((row) => row.key === primary)!, [primary]);
  const b = useMemo(() => OPTIONS.find((row) => row.key === secondary)!, [secondary]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Metric
          <select
            value={primary}
            onChange={(event) => setPrimary(event.target.value as MetricKey)}
            className="rounded-lg border border-border px-2 py-1"
          >
            {OPTIONS.map((row) => (
              <option key={row.key} value={row.key}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Compare
          <select
            value={secondary}
            onChange={(event) => setSecondary(event.target.value as MetricKey)}
            className="rounded-lg border border-border px-2 py-1"
          >
            {OPTIONS.map((row) => (
              <option key={row.key} value={row.key}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DailyTrendChart
        title="Meta performance"
        description="Warehouse campaign insights (BigQuery/cache). Not a live Flyweel request. Native campaign grain — reach is not summed from ads."
        days={days}
        seriesA={{ label: a.label, values: series[primary] || [] }}
        seriesB={{ label: b.label, values: series[secondary] || [] }}
      />
    </div>
  );
}
