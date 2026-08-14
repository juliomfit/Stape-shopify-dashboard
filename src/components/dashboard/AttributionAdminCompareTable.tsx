import { ChannelLabel } from "@/components/dashboard/ChannelMark";
import { formatMoney, formatNumber } from "@/lib/format";
import type { AttributionCompareTotals } from "@/lib/shopify/compare";
import {
  StackList,
  StackRow,
  TableOrCards,
} from "@/components/dashboard/TableOrCards";

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
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">
        Shopify Attribution (Admin) vs gn_*
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Shopify = 30-day Admin first-click. We = cart gn_*. Totals must match;
        channels may not. {periodLabel}. Not mixed with Stape warehouse models.
      </p>
      <div className="mt-4">
        <TableOrCards
          cards={
            <StackList>
              {data.rows.map((row) => (
                <StackRow key={row.channel}>
                  <div className="flex items-start justify-between gap-3">
                    <ChannelLabel name={row.channel} />
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatMoney({ amount: row.gnRevenue, currencyCode })}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    gn_* {formatNumber(row.gnOrders)} vs Admin{" "}
                    {formatNumber(row.shopifyOrders)} orders
                  </p>
                </StackRow>
              ))}
            </StackList>
          }
          table={
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
          }
        />
      </div>
    </article>
  );
}
