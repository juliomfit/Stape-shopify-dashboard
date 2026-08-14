import { ChannelLabel } from "@/components/dashboard/ChannelMark";
import { formatMoney, formatNumber } from "@/lib/format";
import type { PlatformCompareRow } from "@/lib/dashboard/true-performance";
import {
  StackList,
  StackRow,
  TableOrCards,
} from "@/components/dashboard/TableOrCards";

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
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">
        Platform-reported vs real
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Real = Shopify first-touch from gn_* cart attributes. Platform = what
        Ads Manager claims. A positive gap means the platform is claiming more
        sales than first-touch can support.
      </p>
      <div className="mt-4">
        <TableOrCards
          cards={
            <StackList>
              {rows.map((row) => (
                <StackRow key={row.channel}>
                  <ChannelLabel name={row.channel} />
                  <p className="text-xs text-muted">
                    Real {formatNumber(row.realPurchases)} vs platform{" "}
                    {row.platformPurchases === null
                      ? "—"
                      : formatNumber(row.platformPurchases)}
                    {" · "}
                    {formatMoney({ amount: row.realRevenue, currencyCode })}
                  </p>
                </StackRow>
              ))}
            </StackList>
          }
          table={
            <table className="dash-table min-w-[40rem]">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="num">Platform purchases</th>
                  <th className="num">Real purchases</th>
                  <th className="num">Gap</th>
                  <th className="num">Platform revenue</th>
                  <th className="num">Real revenue</th>
                  <th className="num">Spend</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.channel}>
                    <td>
                      <ChannelLabel name={row.channel} />
                    </td>
                    <td className="num text-muted">
                      {row.platformPurchases === null
                        ? "—"
                        : formatNumber(row.platformPurchases)}
                    </td>
                    <td className="num text-muted">
                      {formatNumber(row.realPurchases)}
                    </td>
                    <td className="num text-muted">
                      {row.purchaseGap === null ? "—" : formatNumber(row.purchaseGap)}
                    </td>
                    <td className="num text-muted">
                      {row.platformRevenue === null
                        ? "—"
                        : formatMoney({
                            amount: row.platformRevenue,
                            currencyCode,
                          })}
                    </td>
                    <td className="num text-muted">
                      {formatMoney({ amount: row.realRevenue, currencyCode })}
                    </td>
                    <td className="num text-muted">
                      {row.platformSpend === null
                        ? "—"
                        : formatMoney({ amount: row.platformSpend, currencyCode })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        />
      </div>
      {facebookNote || googleNote ? (
        <p className="mt-3 text-xs leading-5 text-muted">
          {[facebookNote, googleNote].filter(Boolean).join(" ")}
        </p>
      ) : null}
    </article>
  );
}
