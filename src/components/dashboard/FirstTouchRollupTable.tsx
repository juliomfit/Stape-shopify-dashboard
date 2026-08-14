import { ChannelLabel } from "@/components/dashboard/ChannelMark";
import { formatMoney, formatNumber } from "@/lib/format";
import type { FirstTouchRollup } from "@/lib/shopify/first-touch";
import {
  StackList,
  StackRow,
  TableOrCards,
} from "@/components/dashboard/TableOrCards";

type FirstTouchRollupTableProps = {
  title: string;
  description: string;
  rows: FirstTouchRollup[];
  currencyCode: string;
  showRoas?: boolean;
};

export function FirstTouchRollupTable({
  title,
  description,
  rows,
  currencyCode,
  showRoas = true,
}: FirstTouchRollupTableProps) {
  const hasChannelSpend = rows.some((row) => row.spend !== null && row.spend > 0);
  const showRoasColumns = showRoas && hasChannelSpend;

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No orders in this range.</p>
      ) : (
        <div className="mt-4">
          <TableOrCards
            cards={
              <StackList>
                {rows.map((row) => (
                  <StackRow key={row.label}>
                    <div className="flex items-start justify-between gap-3">
                      <ChannelLabel name={row.label} />
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatMoney({ amount: row.revenue, currencyCode })}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {formatNumber(row.orders)} orders
                      {showRoasColumns
                        ? ` · ROAS ${row.roas === null ? "—" : `${row.roas.toFixed(2)}x`}`
                        : ""}
                    </p>
                  </StackRow>
                ))}
              </StackList>
            }
            table={
              <table className="dash-table min-w-[28rem]">
            <thead>
              <tr>
                <th>Group</th>
                <th className="num">Orders</th>
                <th className="num">Revenue</th>
                <th className="num">New-customer orders</th>
                {showRoasColumns ? (
                  <>
                    <th className="num">ROAS</th>
                    <th className="num">NC ROAS</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>
                    <ChannelLabel name={row.label} />
                  </td>
                  <td className="num text-muted">{formatNumber(row.orders)}</td>
                  <td className="num text-muted">
                    {formatMoney({ amount: row.revenue, currencyCode })}
                  </td>
                  <td className="num text-muted">
                    {formatNumber(row.newCustomerOrders)}
                  </td>
                  {showRoasColumns ? (
                    <>
                      <td className="num text-muted">
                        {row.roas === null ? "—" : `${row.roas.toFixed(2)}x`}
                      </td>
                      <td className="num text-muted">
                        {row.newCustomerRoas === null
                          ? "—"
                          : `${row.newCustomerRoas.toFixed(2)}x`}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
            }
          />
        </div>
      )}
    </article>
  );
}
