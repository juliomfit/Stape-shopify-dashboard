import { ChannelLabel } from "@/components/dashboard/ChannelMark";
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
        <table className="dash-table min-w-[44rem]">
          <thead>
            <tr>
              <th>Channel</th>
              <th className="num">Shopify orders</th>
              <th className="num">gn_* orders</th>
              <th className="num">Order gap</th>
              <th className="num">Shopify revenue</th>
              <th className="num">gn_* revenue</th>
              <th className="num">Revenue gap</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.channel}>
                <td>
                  <ChannelLabel name={row.channel} />
                </td>
                <td className="num text-muted">{formatNumber(row.shopifyOrders)}</td>
                <td className="num text-muted">{formatNumber(row.gnOrders)}</td>
                <td className="num text-muted">{formatNumber(row.orderGap)}</td>
                <td className="num text-muted">
                  {formatMoney({ amount: row.shopifyRevenue, currencyCode })}
                </td>
                <td className="num text-muted">
                  {formatMoney({ amount: row.gnRevenue, currencyCode })}
                </td>
                <td className="num text-muted">
                  {formatMoney({ amount: row.revenueGap, currencyCode })}
                </td>
              </tr>
            ))}
            <tr className="font-medium text-foreground">
              <td>Totals</td>
              <td className="num">{formatNumber(data.orders)}</td>
              <td className="num">{formatNumber(data.orders)}</td>
              <td className="num">0</td>
              <td className="num">
                {formatMoney({ amount: data.revenue, currencyCode })}
              </td>
              <td className="num">
                {formatMoney({ amount: data.revenue, currencyCode })}
              </td>
              <td className="num">
                {formatMoney({ amount: 0, currencyCode })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}
