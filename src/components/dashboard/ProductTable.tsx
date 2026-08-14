import type { TopProduct } from "@/lib/shopify/types";
import { formatMoney, formatNumber } from "@/lib/format";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import {
  StackList,
  StackRow,
  TableOrCards,
} from "@/components/dashboard/TableOrCards";

type ProductTableProps = {
  products: TopProduct[];
  periodLabel: string;
  connected?: boolean;
};

export function ProductTable({
  products,
  periodLabel,
  connected = false,
}: ProductTableProps) {
  if (products.length === 0) {
    return (
      <EmptyPanel
        title="Products"
        description={
          connected
            ? "No product line items in this date range."
            : "Product sales will appear here after Shopify is connected."
        }
      />
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-4 py-4 lg:px-6">
        <h2 className="text-sm font-semibold text-foreground">
          Product sales
        </h2>
        <p className="mt-1 text-xs text-muted">
          {periodLabel} · line-item totals (excludes shipping and tax) · sorted
          by revenue
        </p>
      </div>
      <TableOrCards
        cards={
          <StackList>
            {products.map((product) => (
              <StackRow key={product.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-medium text-foreground">
                    {product.title}
                  </p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoney(product.revenue)}
                  </p>
                </div>
                <p className="text-xs text-muted">
                  {formatNumber(product.quantity)} units
                </p>
              </StackRow>
            ))}
          </StackList>
        }
        table={
          <table className="dash-table min-w-[32rem]">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">Units sold</th>
              <th className="num">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td className="text-foreground">{product.title}</td>
                <td className="num text-muted">{formatNumber(product.quantity)}</td>
                <td className="num text-foreground">
                  {formatMoney(product.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        }
      />
    </article>
  );
}
