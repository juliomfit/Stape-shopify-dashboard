import { formatMoney, formatNumber, formatPercent } from "@/lib/format";

export type DonutSlice = {
  label: string;
  value: number;
};

type DonutChartProps = {
  title: string;
  description?: string;
  slices: DonutSlice[];
  currencyCode?: string;
  emptyLabel?: string;
};

export const CHART_PALETTE = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#ef4444",
  "#8b5cf6",
  "#0ea5e9",
  "#64748b",
];

export function DonutChart({
  title,
  description,
  slices,
  currencyCode,
  emptyLabel = "No data for this range yet.",
}: DonutChartProps) {
  const ranked = [...slices]
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = ranked.reduce((sum, slice) => sum + slice.value, 0);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const dashes = ranked.map((slice) => (slice.value / total) * circumference);
  const arcs = ranked.map((slice, index) => {
    const precedingLength = dashes
      .slice(0, index)
      .reduce((sum, dash) => sum + dash, 0);
    return {
      color: CHART_PALETTE[index % CHART_PALETTE.length],
      dash: dashes[index],
      gap: circumference - dashes[index],
      dashoffset: -precedingLength,
      fraction: slice.value / total,
    };
  });

  const formatValue = (value: number) =>
    currencyCode ? formatMoney({ amount: value, currencyCode }) : formatNumber(value);

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      ) : null}

      {total <= 0 ? (
        <p className="mt-8 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
          <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0 -rotate-90">
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              className="text-border"
              stroke="currentColor"
              strokeWidth="18"
            />
            {arcs.map((arc, index) => (
              <circle
                key={index}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth="18"
                strokeDasharray={`${arc.dash} ${arc.gap}`}
                strokeDashoffset={arc.dashoffset}
              />
            ))}
          </svg>
          <ul className="flex-1 space-y-2">
            {ranked.map((slice, index) => (
              <li
                key={slice.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex items-center gap-2 text-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length],
                    }}
                  />
                  {slice.label}
                </span>
                <span className="text-muted">
                  {formatValue(slice.value)} · {formatPercent(arcs[index].fraction)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
