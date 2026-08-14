import { ChannelLabel } from "@/components/dashboard/ChannelMark";
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
        <table className="dash-table min-w-[20rem]">
          <thead>
            <tr>
              <th>Channel</th>
              <th className="num">Orders</th>
              <th className="num">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="text-muted" colSpan={3}>
                  No credited touches in this window
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.channel}>
                  <td>
                    <ChannelLabel name={row.channel} />
                  </td>
                  <td className="num text-muted">{formatNumber(row.orders)}</td>
                  <td className="num text-muted">
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
