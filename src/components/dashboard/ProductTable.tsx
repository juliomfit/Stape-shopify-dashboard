import type { TopProduct } from "@/lib/shopify/types";
import { formatMoney, formatNumber } from "@/lib/format";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";

type ProductTableProps = {
  products: TopProduct[];
};

export function ProductTable({ products }: ProductTableProps) {
  if (products.length === 0) {
    return (
      <EmptyPanel
        title="Products"
        description="Product sales will appear here after Shopify is connected."
      />
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          Product sales
        </h2>
        <p className="mt-1 text-xs text-muted">Last 30 days · sorted by revenue</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-6 py-3 font-medium">Product</th>
              <th className="px-6 py-3 text-right font-medium">Units sold</th>
              <th className="px-6 py-3 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-6 py-3 text-foreground">{product.title}</td>
                <td className="px-6 py-3 text-right text-muted">
                  {formatNumber(product.quantity)}
                </td>
                <td className="px-6 py-3 text-right text-foreground">
                  {formatMoney(product.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
