import { formatMoney, formatNumber } from "@/lib/format";
import type { AttributionCompareTotals } from "@/lib/shopify/compare";

type AttributionAdminCompareTableProps = {
  data: AttributionCompareTotals;
  currencyCode: string;
  periodLabel: string;
};

export function AttributionAdminCompareTable({
  data,
  currencyCode,
  periodLabel,
}: AttributionAdminCompareTableProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Shopify Attribution (Admin) vs gn_*
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Shopify = 30-day Admin first-click. We = cart gn_*. Totals must match;
        channels may not. {periodLabel}. Not mixed with Stape warehouse models.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="pb-2 font-medium">Channel</th>
              <th className="pb-2 font-medium">Shopify orders</th>
              <th className="pb-2 font-medium">gn_* orders</th>
              <th className="pb-2 font-medium">Order gap</th>
              <th className="pb-2 font-medium">Shopify revenue</th>
              <th className="pb-2 font-medium">gn_* revenue</th>
              <th className="pb-2 font-medium">Revenue gap</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.channel} className="border-b border-border last:border-0">
                <td className="py-2.5 text-foreground">{row.channel}</td>
                <td className="py-2.5 text-muted">{formatNumber(row.shopifyOrders)}</td>
                <td className="py-2.5 text-muted">{formatNumber(row.gnOrders)}</td>
                <td className="py-2.5 text-muted">{formatNumber(row.orderGap)}</td>
                <td className="py-2.5 text-muted">
                  {formatMoney({ amount: row.shopifyRevenue, currencyCode })}
                </td>
                <td className="py-2.5 text-muted">
                  {formatMoney({ amount: row.gnRevenue, currencyCode })}
                </td>
                <td className="py-2.5 text-muted">
                  {formatMoney({ amount: row.revenueGap, currencyCode })}
                </td>
              </tr>
            ))}
            <tr className="font-medium text-foreground">
              <td className="py-2.5">Totals</td>
              <td className="py-2.5">{formatNumber(data.orders)}</td>
              <td className="py-2.5">{formatNumber(data.orders)}</td>
              <td className="py-2.5">0</td>
              <td className="py-2.5">
                {formatMoney({ amount: data.revenue, currencyCode })}
              </td>
              <td className="py-2.5">
                {formatMoney({ amount: data.revenue, currencyCode })}
              </td>
              <td className="py-2.5">
                {formatMoney({ amount: 0, currencyCode })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}
