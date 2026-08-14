import { formatMoney, formatNumber } from "@/lib/format";
import type { ShopifyqlChannelRow } from "@/lib/shopify/get-shopify-attribution";

type ShopifyAttributionChannelTableProps = {
  rows: ShopifyqlChannelRow[];
  currencyCode: string;
  fallback: boolean;
};

export function ShopifyAttributionChannelTable({
  rows,
  currencyCode,
  fallback,
}: ShopifyAttributionChannelTableProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Sales by referring channel
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        {fallback
          ? "ShopifyQL failed. This rollup is firstVisit on each order, not the Attribution Center table."
          : "ShopifyQL sales with the selected Admin attribution model. Shopify sessions are not the conversion denominator here."}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="pb-2 font-medium">Channel</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Orders</th>
              <th className="pb-2 font-medium">Sales</th>
              <th className="pb-2 font-medium">AOV</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="py-3 text-muted" colSpan={5}>
                  No Shopify Attribution rows for this range.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="py-2.5 text-foreground">{row.channel}</td>
                  <td className="py-2.5 text-muted">{row.type}</td>
                  <td className="py-2.5 text-muted">{formatNumber(row.orders)}</td>
                  <td className="py-2.5 text-muted">
                    {formatMoney({ amount: row.sales, currencyCode })}
                  </td>
                  <td className="py-2.5 text-muted">
                    {row.orders > 0
                      ? formatMoney({ amount: row.aov, currencyCode })
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
