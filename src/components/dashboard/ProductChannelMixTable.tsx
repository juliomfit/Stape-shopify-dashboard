import { ChannelLabel } from "@/components/dashboard/ChannelMark";
import { formatMoney, formatNumber } from "@/lib/format";
import type { ProductChannelMix } from "@/lib/shopify/types";

type ProductChannelMixTableProps = {
  rows: ProductChannelMix[];
  currencyCode: string;
  periodLabel: string;
};

export function ProductChannelMixTable({
  rows,
  currencyCode,
  periodLabel,
}: ProductChannelMixTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">
        Line-item revenue by first-touch
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Same gn_* channel as the parent Shopify order · {periodLabel}. Line-item
        totals exclude shipping and tax.
      </p>
        <div className="mt-4 overflow-x-auto">
          <table className="dash-table min-w-0 md:min-w-[24rem]">
          <thead>
            <tr>
              <th>First-touch</th>
              <th className="num">Units</th>
              <th className="num">Line-item revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.channel}>
                <td>
                  <ChannelLabel name={row.channel} />
                </td>
                <td className="num text-muted">{formatNumber(row.quantity)}</td>
                <td className="num text-muted">
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
