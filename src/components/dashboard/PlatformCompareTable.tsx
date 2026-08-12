import { formatMoney, formatNumber } from "@/lib/format";
import type { PlatformCompareRow } from "@/lib/dashboard/true-performance";

type PlatformCompareTableProps = {
  rows: PlatformCompareRow[];
  currencyCode: string;
  facebookNote?: string;
  googleNote?: string;
};

export function PlatformCompareTable({
  rows,
  currencyCode,
  facebookNote,
  googleNote,
}: PlatformCompareTableProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Platform-reported vs real
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Ads Manager numbers vs last non-direct Stape purchases. A positive gap
        means the platform is claiming more sales than first-party data can
        support.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="pb-2 font-medium">Channel</th>
              <th className="pb-2 font-medium">Platform purchases</th>
              <th className="pb-2 font-medium">Real purchases</th>
              <th className="pb-2 font-medium">Gap</th>
              <th className="pb-2 font-medium">Platform revenue</th>
              <th className="pb-2 font-medium">Real revenue</th>
              <th className="pb-2 font-medium">Spend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.channel} className="border-b border-border last:border-0">
                <td className="py-2.5 text-foreground">{row.channel}</td>
                <td className="py-2.5 text-muted">
                  {row.platformPurchases === null
                    ? "—"
                    : formatNumber(row.platformPurchases)}
                </td>
                <td className="py-2.5 text-muted">
                  {formatNumber(row.realPurchases)}
                </td>
                <td className="py-2.5 text-muted">
                  {row.purchaseGap === null ? "—" : formatNumber(row.purchaseGap)}
                </td>
                <td className="py-2.5 text-muted">
                  {row.platformRevenue === null
                    ? "—"
                    : formatMoney({
                        amount: row.platformRevenue,
                        currencyCode,
                      })}
                </td>
                <td className="py-2.5 text-muted">
                  {formatMoney({ amount: row.realRevenue, currencyCode })}
                </td>
                <td className="py-2.5 text-muted">
                  {row.platformSpend === null
                    ? "—"
                    : formatMoney({ amount: row.platformSpend, currencyCode })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {facebookNote || googleNote ? (
        <p className="mt-3 text-xs leading-5 text-muted">
          {[facebookNote, googleNote].filter(Boolean).join(" ")}
        </p>
      ) : null}
    </article>
  );
}
