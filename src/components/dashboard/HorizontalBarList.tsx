import { formatMoney, formatNumber } from "@/lib/format";

export type BarRow = {
  label: string;
  value: number;
  secondary?: string;
};

type HorizontalBarListProps = {
  title: string;
  description?: string;
  rows: BarRow[];
  currencyCode?: string;
  emptyLabel?: string;
};

export function HorizontalBarList({
  title,
  description,
  rows,
  currencyCode,
  emptyLabel = "No data for this range yet.",
}: HorizontalBarListProps) {
  const ranked = [...rows]
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const max = ranked.reduce((peak, row) => Math.max(peak, row.value), 0);

  const formatValue = (value: number) =>
    currencyCode ? formatMoney({ amount: value, currencyCode }) : formatNumber(value);

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      ) : null}

      {ranked.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="mt-5 space-y-3.5">
          {ranked.map((row) => (
            <li key={row.label}>
              <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                <span className="text-foreground">{row.label}</span>
                <span className="text-muted">
                  {formatValue(row.value)}
                  {row.secondary ? (
                    <span className="ml-2 text-xs">{row.secondary}</span>
                  ) : null}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${max > 0 ? Math.max((row.value / max) * 100, 2) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
