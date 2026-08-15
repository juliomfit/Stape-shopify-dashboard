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
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Line-item revenue by first-touch
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Same gn_* channel as the parent Shopify order · {periodLabel}. Line-item
        totals exclude shipping and tax.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[24rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="pb-2 font-medium">First-touch</th>
              <th className="pb-2 font-medium">Units</th>
              <th className="pb-2 font-medium">Line-item revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.channel} className="border-b border-border last:border-0">
                <td className="py-2.5 text-foreground">
                  <ChannelLabel name={row.channel} />
                </td>
                <td className="py-2.5 text-muted">{formatNumber(row.quantity)}</td>
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
