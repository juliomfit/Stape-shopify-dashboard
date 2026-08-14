import { formatMoney, formatNumber } from "@/lib/format";
import type { FirstTouchRollup } from "@/lib/shopify/first-touch";

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
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No orders in this range.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
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
                  <td className="text-foreground">{row.label}</td>
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
        </div>
      )}
    </article>
  );
}
