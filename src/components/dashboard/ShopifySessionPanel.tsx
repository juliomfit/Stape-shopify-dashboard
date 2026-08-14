"use client";

import { useMemo, useState } from "react";
import { DailyTrendChart } from "@/components/dashboard/DailyTrendChart";
import { ShopifySessionTable } from "@/components/dashboard/ShopifySessionTable";
import type { ShopifyqlSessionPoint } from "@/lib/shopify/get-shopify-attribution";

type ShopifySessionPanelProps = {
  points: ShopifyqlSessionPoint[];
  error: string | null;
};

function channelKey(point: ShopifyqlSessionPoint) {
  return `${point.channel} / ${point.type}`;
}

export function ShopifySessionPanel({ points, error }: ShopifySessionPanelProps) {
  const [showTable, setShowTable] = useState(false);
  const chart = useMemo(() => {
    const hours = [...new Set(points.map((point) => point.hour))].sort();
    const totals = new Map<string, number>();
    for (const point of points) {
      const key = channelKey(point);
      totals.set(key, (totals.get(key) || 0) + point.sessions);
    }
    const top = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key]) => key);
    const byHourChannel = new Map<string, number>();
    for (const point of points) {
      byHourChannel.set(`${point.hour}::${channelKey(point)}`, point.sessions);
    }
    const series = top.map((key) => ({
      label: key,
      values: hours.map(
        (hour) => byHourChannel.get(`${hour}::${key}`) || 0,
      ),
    }));
    return { hours, series };
  }, [points]);

  return (
    <div className="flex flex-col gap-3">
      {chart.hours.length > 0 && chart.series[0] ? (
        <DailyTrendChart
          title="Shopify sessions by hour"
          description="Shopify storefront sessions, not Stape. Top 5 channels."
          days={chart.hours}
          seriesA={chart.series[0]}
          extraSeries={chart.series.slice(1)}
        />
      ) : null}
      <button
        type="button"
        className="self-start text-xs font-medium text-accent hover:underline"
        onClick={() => setShowTable((value) => !value)}
      >
        {showTable ? "Hide hourly table" : "Show hourly table"}
      </button>
      {showTable || chart.hours.length === 0 ? (
        <ShopifySessionTable points={points} error={error} />
      ) : null}
    </div>
  );
}
