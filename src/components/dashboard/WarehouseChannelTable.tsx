import { formatMoney, formatNumber } from "@/lib/format";
import type { WarehouseChannelRow } from "@/lib/warehouse/types";

type Props = {
  title: string;
  description: string;
  rows: WarehouseChannelRow[];
  currencyCode: string;
};

export function WarehouseChannelTable({
  title,
  description,
  rows,
  currencyCode,
}: Props) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="pb-2 font-medium">Channel</th>
              <th className="pb-2 font-medium">Orders</th>
              <th className="pb-2 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="py-2.5 text-muted" colSpan={3}>
                  No credited touches in this window
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.channel}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-2.5 text-foreground">{row.channel}</td>
                  <td className="py-2.5 text-muted">
                    {formatNumber(row.orders)}
                  </td>
                  <td className="py-2.5 text-muted">
                    {formatMoney({ amount: row.revenue, currencyCode })}
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
