import Link from "next/link";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { EntityRollup } from "@/lib/ads/meta-query";

function money(amount: number, currency: string) {
  return formatMoney({ amount, currencyCode: currency });
}

export function MetaEntityTable({
  rows,
  hrefFor,
  currency = "USD",
}: {
  rows: EntityRollup[];
  hrefFor?: (row: EntityRollup) => string;
  currency?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        No Meta insights for this period. Connect Meta and press Refresh Meta.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[720px] w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th className="py-2 pr-3 font-medium">Name</th>
            <th className="py-2 pr-3 font-medium">Spend</th>
            <th className="py-2 pr-3 font-medium">Purchases</th>
            <th className="py-2 pr-3 font-medium">Revenue</th>
            <th className="py-2 pr-3 font-medium">ROAS</th>
            <th className="py-2 pr-3 font-medium">CPA</th>
            <th className="py-2 pr-3 font-medium">Impr.</th>
            <th className="py-2 pr-3 font-medium">CTR</th>
            <th className="py-2 font-medium">CPC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const name = hrefFor ? (
              <Link href={hrefFor(row)} className="font-medium text-foreground underline">
                {row.name}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{row.name}</span>
            );
            return (
              <tr key={row.id} className="border-b border-border/70">
                <td className="py-2 pr-3">{name}</td>
                <td className="py-2 pr-3">{money(row.spend, currency)}</td>
                <td className="py-2 pr-3">{formatNumber(row.purchases)}</td>
                <td className="py-2 pr-3">{money(row.purchaseValue, currency)}</td>
                <td className="py-2 pr-3">
                  {row.roas === null ? "—" : `${row.roas.toFixed(2)}x`}
                </td>
                <td className="py-2 pr-3">
                  {row.cpa === null ? "—" : money(row.cpa, currency)}
                </td>
                <td className="py-2 pr-3">{formatNumber(row.impressions)}</td>
                <td className="py-2 pr-3">
                  {row.ctr === null ? "—" : formatPercent(row.ctr)}
                </td>
                <td className="py-2">{row.cpc === null ? "—" : money(row.cpc, currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
