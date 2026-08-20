"use client";

import { useMemo, useState } from "react";
import { DailyTrendChart } from "@/components/dashboard/DailyTrendChart";
import { HorizontalBarList } from "@/components/dashboard/HorizontalBarList";
import { MetaPerformanceChart } from "@/components/dashboard/MetaPerformanceChart";
import { FirstPartySourceLabel } from "@/components/dashboard/MetaSourceBadges";
import type { BarRow } from "@/components/dashboard/HorizontalBarList";
import {
  ALL_CAMPAIGNS_KEY,
  FLYWEEL_AD_SPEND_UNAVAILABLE,
  FLYWEEL_ADSET_SPEND_UNAVAILABLE,
  type ObservedEntityDailySeries,
} from "@/lib/attribution/observed-meta-grain";

type MetricKey =
  | "spend"
  | "purchase_value"
  | "purchases"
  | "roas"
  | "cpa"
  | "cpm"
  | "ctr"
  | "cpc"
  | "frequency";
type Grain = "campaigns" | "adsets" | "ads";
type ChildMetric = "revenue" | "attributedOrders";

export type ChildBar = {
  label: string;
  revenue: number;
  attributedOrders: number;
};

function toBarRows(rows: ChildBar[], metric: ChildMetric): BarRow[] {
  return rows.map((row) => ({
    label: row.label,
    value: metric === "revenue" ? row.revenue : row.attributedOrders,
    secondary:
      metric === "revenue" ? `${row.attributedOrders.toFixed(1)} attributed orders` : undefined,
  }));
}

function sourceExtra(grain: Grain) {
  if (grain === "adsets") return FLYWEEL_ADSET_SPEND_UNAVAILABLE;
  if (grain === "ads") return FLYWEEL_AD_SPEND_UNAVAILABLE;
  return "";
}

export function MetaAnalyticsChart({
  days,
  platformSeries,
  campaignSeries,
  adsetSeries,
  adSeries,
  allCampaigns,
  adsetBars,
  adBars,
  campaignBars,
}: {
  days: string[];
  platformSeries: Record<MetricKey, number[]>;
  campaignSeries: ObservedEntityDailySeries[];
  adsetSeries: ObservedEntityDailySeries[];
  adSeries: ObservedEntityDailySeries[];
  allCampaigns: ObservedEntityDailySeries;
  adsetBars: ChildBar[];
  adBars: ChildBar[];
  campaignBars: ChildBar[];
}) {
  const [grain, setGrain] = useState<Grain>("campaigns");
  const [childMetric, setChildMetric] = useState<ChildMetric>("revenue");
  const [entityOverride, setEntityOverride] = useState<string | null>(null);

  const entityOptions = useMemo(() => {
    if (grain === "adsets") return adsetSeries;
    if (grain === "ads") return adSeries;
    return [allCampaigns, ...campaignSeries.filter((row) => row.key !== ALL_CAMPAIGNS_KEY)];
  }, [grain, adsetSeries, adSeries, allCampaigns, campaignSeries]);

  const defaultEntityKey =
    grain === "campaigns"
      ? ALL_CAMPAIGNS_KEY
      : grain === "adsets"
        ? (adsetSeries[0]?.key ?? "")
        : (adSeries[0]?.key ?? "");
  const entityKey =
    entityOverride && entityOptions.some((row) => row.key === entityOverride)
      ? entityOverride
      : defaultEntityKey;

  const selected = entityOptions.find((row) => row.key === entityKey) ?? entityOptions[0] ?? null;
  const childRows = toBarRows(
    grain === "adsets" ? adsetBars : grain === "ads" ? adBars : campaignBars,
    childMetric,
  );
  const childTitle =
    grain === "adsets"
      ? childMetric === "revenue"
        ? "OUR revenue by ad set"
        : "OUR attributed orders by ad set"
      : grain === "ads"
        ? childMetric === "revenue"
          ? "OUR revenue by ad"
          : "OUR attributed orders by ad"
        : childMetric === "revenue"
          ? "OUR revenue by campaign"
          : "OUR attributed orders by campaign";
  const extra = sourceExtra(grain);
  const childSubtitle =
    grain === "campaigns"
      ? "GoodsNova first-party attributed revenue. Campaign view may sit beside Flyweel campaign spend above."
      : `First-party attributed revenue. ${extra}`;
  const timeSeriesValues =
    selected?.points.map((point) =>
      childMetric === "revenue" ? point.revenue : point.attributedOrders,
    ) ?? days.map(() => 0);
  const entityLabel =
    grain === "campaigns" ? "Campaign" : grain === "adsets" ? "Ad set" : "Ad";
  const showEntitySelect = grain === "campaigns" ? campaignSeries.length > 1 : entityOptions.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">View</span>
        {(["campaigns", "adsets", "ads"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setGrain(key);
              setEntityOverride(null);
            }}
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
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          Metric
          <select
            value={childMetric}
            onChange={(event) => setChildMetric(event.target.value as ChildMetric)}
            className="rounded-lg border border-border px-2 py-1"
          >
            <option value="revenue">Revenue</option>
            <option value="attributedOrders">Attributed orders</option>
          </select>
        </label>
        {showEntitySelect ? (
          <label className="flex items-center gap-2 text-sm">
            {entityLabel}
            <select
              value={selected?.key ?? ""}
              onChange={(event) => setEntityOverride(event.target.value)}
              className="rounded-lg border border-border px-2 py-1"
            >
              {entityOptions.map((row) => (
                <option key={row.key} value={row.key}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <DailyTrendChart
        title={
          childMetric === "revenue"
            ? "OUR Meta attributed revenue over time"
            : "OUR Meta attributed orders over time"
        }
        description={`${selected?.label ? `${selected.label}. ` : ""}GoodsNova first-party attribution. Same existing credit grouped by order purchase day in America/Los_Angeles. Not redistributed.${extra ? ` ${extra}` : ""}`}
        days={days}
        seriesA={{
          label: childMetric === "revenue" ? "OUR revenue" : "Attributed orders",
          values: timeSeriesValues,
        }}
      />
      <FirstPartySourceLabel extra={extra} />
    </div>
  );
}

export function ObservedBarChart({
  title,
  rows,
  currencyCode,
  emptyLabel,
  grain,
}: {
  title: string;
  rows: ChildBar[];
  currencyCode: string;
  emptyLabel?: string;
  grain: "adset" | "ad";
}) {
  const [metric, setMetric] = useState<ChildMetric>("revenue");
  const chartRows = useMemo(() => toBarRows(rows, metric), [metric, rows]);
  const extra = grain === "ad" ? FLYWEEL_AD_SPEND_UNAVAILABLE : FLYWEEL_ADSET_SPEND_UNAVAILABLE;
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        Metric
        <select
          value={metric}
          onChange={(event) => setMetric(event.target.value as ChildMetric)}
          className="rounded-lg border border-border px-2 py-1"
        >
          <option value="revenue">Revenue</option>
          <option value="attributedOrders">Attributed orders</option>
        </select>
      </label>
      <HorizontalBarList
        title={title}
        description={`First-party attributed ${metric === "revenue" ? "revenue" : "orders"}. ${extra}`}
        rows={chartRows}
        currencyCode={metric === "revenue" ? currencyCode : undefined}
        emptyLabel={emptyLabel}
      />
      <FirstPartySourceLabel extra={extra} />
    </div>
  );
}
