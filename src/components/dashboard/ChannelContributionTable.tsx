import { formatMoney, formatNumber } from "@/lib/format";
import type { ChannelContribution } from "@/lib/stape/attribution-types";

type ChannelContributionTableProps = {
  title: string;
  description: string;
  rows: ChannelContribution[];
  currencyCode: string;
};

export function ChannelContributionTable({
  title,
  description,
  rows,
  currencyCode,
}: ChannelContributionTableProps) {
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
            {rows.map((row) => (
              <tr key={row.source} className="border-b border-border last:border-0">
                <td className="py-2.5 text-foreground">{row.source}</td>
                <td className="py-2.5 text-muted">{formatNumber(row.orders)}</td>
                <td className="py-2.5 text-muted">
                  {formatMoney({ amount: row.revenue, currencyCode })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
