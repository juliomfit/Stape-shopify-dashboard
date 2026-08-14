import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { journeyQuality } from "@/lib/shopify/compare";
import type { OrderPoint } from "@/lib/shopify/types";

type JourneyQualityPanelProps = {
  orders: OrderPoint[];
};

export function JourneyQualityPanel({ orders }: JourneyQualityPanelProps) {
  const quality = journeyQuality(orders);

  const rows = [
    {
      label: "Orders with journey ready",
      value: quality.readyRate,
      count: `${quality.ready} / ${quality.total}`,
    },
    {
      label: "Shopify vs gn_* channel mismatch",
      value: quality.mismatchRate,
      count: `${quality.mismatch} / ${quality.total}`,
    },
    {
      label: "Shopify Direct with gn_* click id",
      value: quality.shopifyDirectWithGnClickIdRate,
      count: `${quality.shopifyDirectWithGnClickId} / ${quality.total}`,
    },
  ];

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Shopify journey vs gn_*
      </h2>
      <p className="mt-1 text-xs text-muted">
        Admin first-click compared to cart gn_*. Totals stay Shopify orders.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-4 py-3"
          >
            <span className="text-sm text-foreground">
              {row.label}
              <span className="mt-0.5 block text-xs text-muted">{row.count}</span>
            </span>
            <span className="text-sm text-muted">
              {row.value === null ? "—" : formatPercent(row.value)}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
