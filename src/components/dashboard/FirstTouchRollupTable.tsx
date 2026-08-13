import { formatMoney, formatNumber } from "@/lib/format";
import type { FirstTouchRollup } from "@/lib/shopify/first-touch";

type FirstTouchRollupTableProps = {
  title: string;
  description: string;
  rows: FirstTouchRollup[];
  currencyCode: string;
};

export function FirstTouchRollupTable({
  title,
  description,
  rows,
  currencyCode,
}: FirstTouchRollupTableProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No orders in this range.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="pb-2 font-medium">Group</th>
                <th className="pb-2 font-medium">Orders</th>
                <th className="pb-2 font-medium">Revenue</th>
                <th className="pb-2 font-medium">New customers</th>
                <th className="pb-2 font-medium">ROAS</th>
                <th className="pb-2 font-medium">NC ROAS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="py-2.5 text-foreground">{row.label}</td>
                  <td className="py-2.5 text-muted">{formatNumber(row.orders)}</td>
                  <td className="py-2.5 text-muted">
                    {formatMoney({ amount: row.revenue, currencyCode })}
                  </td>
                  <td className="py-2.5 text-muted">
                    {formatNumber(row.newCustomerOrders)}
                  </td>
                  <td className="py-2.5 text-muted">
                    {row.roas === null ? "—" : `${row.roas.toFixed(2)}x`}
                  </td>
                  <td className="py-2.5 text-muted">
                    {row.newCustomerRoas === null
                      ? "—"
                      : `${row.newCustomerRoas.toFixed(2)}x`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
