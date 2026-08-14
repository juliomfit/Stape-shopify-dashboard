"use client";

import { ChannelMark } from "@/components/dashboard/ChannelMark";
import { channelColor } from "@/lib/channel-visual";

type Series = { label: string; values: number[]; dashed?: boolean };

type DailyTrendChartProps = {
  title: string;
  description: string;
  days: string[];
  seriesA: { label: string; values: number[] };
  seriesB?: { label: string; values: number[] };
  extraSeries?: Series[];
};

function pathFor(
  values: number[],
  width: number,
  height: number,
  max: number,
  padLeft: number,
  padTop: number,
) {
  if (values.length === 0) {
    return "";
  }

  const innerW = width - padLeft - 8;
  const innerH = height - padTop - 4;
  const step = values.length === 1 ? 0 : innerW / (values.length - 1);
  return values
    .map((value, index) => {
      const x = padLeft + (values.length === 1 ? innerW / 2 : index * step);
      const y = padTop + innerH - (max > 0 ? (value / max) * innerH : 0);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

const FALLBACK = ["#2563eb", "#64748b", "#7c3aed", "#0d9488", "#ea580c", "#db2777"];

function seriesColor(label: string, index: number) {
  const color = channelColor(label);
  if (color !== "#64748b") {
    return color;
  }
  return FALLBACK[index % FALLBACK.length];
}

export function DailyTrendChart({
  title,
  description,
  days,
  seriesA,
  seriesB,
  extraSeries = [],
}: DailyTrendChartProps) {
  const width = 720;
  const height = 200;
  const padLeft = 40;
  const padTop = 16;
  const series: Series[] = [
    { label: seriesA.label, values: seriesA.values },
    ...(seriesB ? [{ label: seriesB.label, values: seriesB.values, dashed: true }] : []),
    ...extraSeries,
  ];
  const max = Math.max(...series.flatMap((item) => item.values), 0);
  const lastA = seriesA.values[seriesA.values.length - 1];
  const innerH = height - padTop - 4;

  if (days.length === 0) {
    return (
      <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-6 text-sm text-muted">No series for this range.</p>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-5 h-52 w-full"
        role="img"
        aria-label={series.map((item) => item.label).join(" and ")}
      >
        {[0, 0.5, 1].map((frac) => {
          const y = padTop + innerH - frac * innerH;
          return (
            <line
              key={frac}
              x1={padLeft}
              x2={width}
              y1={y}
              y2={y}
              className="stroke-slate-100"
              strokeWidth="1"
            />
          );
        })}
        <text x="0" y={padTop + 4} className="fill-slate-400" fontSize="10">
          {max > 0 ? Math.round(max).toLocaleString() : "0"}
        </text>
        <text x="0" y={height - 2} className="fill-slate-400" fontSize="10">
          0
        </text>
        {series.map((item, index) => (
          <path
            key={item.label}
            d={pathFor(item.values, width, height, max, padLeft, padTop)}
            fill="none"
            stroke={seriesColor(item.label, index)}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={item.dashed ? "5 4" : undefined}
          />
        ))}
        {typeof lastA === "number" ? (
          <text
            x={width}
            y={Math.max(
              padTop + 10,
              padTop + innerH - (max > 0 ? (lastA / max) * innerH : 0) - 6,
            )}
            textAnchor="end"
            className="fill-slate-600"
            fontSize="10"
          >
            {Math.round(lastA).toLocaleString()}
          </text>
        ) : null}
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((item, index) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <ChannelMark name={item.label} size={14} />
            <span
              className="inline-block h-1.5 w-3 rounded-full"
              style={{ background: seriesColor(item.label, index) }}
            />
            {item.label}
          </span>
        ))}
        <span>
          {days[0]} → {days[days.length - 1]}
        </span>
      </div>
    </article>
  );
}
