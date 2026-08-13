import type { TopProduct } from "@/lib/shopify/types";
import { formatMoney, formatNumber } from "@/lib/format";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";

type TopProductsPanelProps = {
  products: TopProduct[];
};

export function TopProductsPanel({ products }: TopProductsPanelProps) {
  if (products.length === 0) {
    return (
      <EmptyPanel
        title="Top Products"
        description="No product line items in this date range, or Shopify is not connected yet."
      />
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Top Products</h2>
      <ul className="mt-4 divide-y divide-border">
        {products.map((product) => (
          <li
            key={product.id}
            className="flex items-center justify-between gap-4 py-3"
          >
            <span className="text-sm text-foreground">{product.title}</span>
            <span className="shrink-0 text-sm text-muted">
              {formatNumber(product.quantity)} sold · {formatMoney(product.revenue)}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
