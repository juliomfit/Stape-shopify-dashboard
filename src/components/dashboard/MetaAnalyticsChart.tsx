"use client";

import { useMemo, useState } from "react";
import { DailyTrendChart } from "@/components/dashboard/DailyTrendChart";
import { HorizontalBarList } from "@/components/dashboard/HorizontalBarList";
import { MetaPerformanceChart } from "@/components/dashboard/MetaPerformanceChart";
import { FirstPartySourceLabel } from "@/components/dashboard/MetaSourceBadges";
import type { BarRow } from "@/components/dashboard/HorizontalBarList";

type MetricKey = "spend" | "purchase_value" | "purchases" | "roas" | "cpa" | "cpm" | "ctr" | "cpc" | "frequency";
type Grain = "campaigns" | "adsets" | "ads";
type ChildMetric = "revenue" | "orders";

export type ChildBar = {
  label: string;
  revenue: number;
  orders: number;
};

function toBarRows(rows: ChildBar[], metric: ChildMetric): BarRow[] {
  return rows.map((row) => ({
    label: row.label,
    value: metric === "revenue" ? row.revenue : row.orders,
    secondary: metric === "revenue" ? `${row.orders.toFixed(1)} orders` : undefined,
  }));
}

export function MetaAnalyticsChart({
  days,
  platformSeries,
  ourDailyRevenue,
  ourDailyOrders,
  adsetBars,
  adBars,
  campaignBars,
}: {
  days: string[];
  platformSeries: Record<MetricKey, number[]>;
  ourDailyRevenue: number[];
  ourDailyOrders: number[];
  adsetBars: ChildBar[];
  adBars: ChildBar[];
  campaignBars: ChildBar[];
}) {
  const [grain, setGrain] = useState<Grain>("campaigns");
  const [childMetric, setChildMetric] = useState<ChildMetric>("revenue");
  const childRows = toBarRows(
    grain === "adsets" ? adsetBars : grain === "ads" ? adBars : campaignBars,
    childMetric,
  );
  const childTitle =
    grain === "adsets"
      ? "OUR revenue by ad set"
      : grain === "ads"
        ? "OUR revenue by ad"
        : "OUR revenue by campaign";
  const childSubtitle =
    grain === "campaigns"
      ? "GoodsNova first-party attributed revenue. Campaign view may sit beside Flyweel campaign spend above."
      : "First-party attributed revenue. Flyweel does not provide ad-set spend.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">View</span>
        {(["campaigns", "adsets", "ads"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setGrain(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              grain === key ? "bg-accent text-white" : "bg-elevated text-muted"
            }`}
          >
            {key === "campaigns" ? "Campaigns" : key === "adsets" ? "Ad Sets" : "Ads"}
          </button>
        ))}
      </div>
      {grain === "campaigns" ? (
        <MetaPerformanceChart days={days} series={platformSeries} />
      ) : (
        <p className="text-xs text-muted">
          {grain === "adsets" ? "Ad Sets: OUR attribution only." : "Ads: OUR attribution only."} Flyweel
          remains campaign-level.
        </p>
      )}
      <HorizontalBarList
        title={childTitle}
        description={childSubtitle}
        rows={childRows}
        currencyCode={childMetric === "revenue" ? "USD" : undefined}
        emptyLabel="No first-party child attribution in this range."
      />
      <label className="flex items-center gap-2 text-sm">
        Child metric
        <select
          value={childMetric}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => setChildMetric(event.target.value as ChildMetric)}
          className="rounded-lg border border-border px-2 py-1"
        >
          <option value="revenue">OUR attributed revenue</option>
          <option value="orders">Attributed orders</option>
        </select>
      </label>
      <FirstPartySourceLabel extra={grain === "campaigns" ? "" : undefined} />
      <DailyTrendChart
        title="OUR Meta attributed revenue over time"
        description="Same existing credit grouped by order purchase day in America/Los_Angeles. Not redistributed."
        days={days}
        seriesA={{ label: "OUR revenue", values: ourDailyRevenue }}
        seriesB={{ label: "Attributed orders", values: ourDailyOrders }}
      />
    </div>
  );
}

export function ObservedBarChart({
  title,
  rows,
  currencyCode,
  emptyLabel,
}: {
  title: string;
  rows: ChildBar[];
  currencyCode: string;
  emptyLabel?: string;
}) {
  const [metric, setMetric] = useState<ChildMetric>("revenue");
  const chartRows = useMemo(() => toBarRows(rows, metric), [metric, rows]);
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        Metric
        <select
          value={metric}
          onChange={(event) => setMetric(event.target.value as ChildMetric)}
          className="rounded-lg border border-border px-2 py-1"
        >
          <option value="revenue">OUR attributed revenue</option>
          <option value="orders">Attributed orders</option>
        </select>
      </label>
      <HorizontalBarList
        title={title}
        description="First-party attributed revenue. Flyweel does not provide ad-set spend."
        rows={chartRows}
        currencyCode={metric === "revenue" ? currencyCode : undefined}
        emptyLabel={emptyLabel}
      />
      <FirstPartySourceLabel />
    </div>
  );
}
