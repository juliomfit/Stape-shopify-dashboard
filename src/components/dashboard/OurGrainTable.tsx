import Link from "next/link";
import { formatMoney, formatNumber } from "@/lib/format";
import type { EntityRollup } from "@/lib/ads/meta-query";
import type { GrainRollup } from "@/lib/attribution/meta-credit";
import { grainAttributedNcac, grainOurRoas } from "@/lib/attribution/meta-credit";

export type OurGrainTableProps = {
  title: string;
  grain: "adset" | "ad";
  platformRows: EntityRollup[];
  ourById: Map<string, GrainRollup>;
  currencyCode: string;
  hrefPrefix?: string;
  showOur: boolean;
};

export function OurGrainTable({
  title,
  grain,
  platformRows,
  ourById,
  currencyCode,
  hrefPrefix,
  showOur,
}: OurGrainTableProps) {
  const money = (amount: number) => formatMoney({ amount, currencyCode });
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        PLATFORM numbers are Flyweel/Ads Manager. OUR ad-set/ad credit is shown
        only when first-party {grain === "adset" ? "adset_id" : "ad_id"} exists
        and matches a Meta fact row. No name fallback. No-spend OUR ROAS / nCAC
        is —.
      </p>
      {platformRows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No platform rows for this range.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="dash-table min-w-[56rem]">
            <thead>
              <tr>
                <th>Name</th>
                <th>ID</th>
                <th className="num">Spend</th>
                <th className="num">Impr.</th>
                <th className="num">Clicks</th>
                <th className="num">CTR</th>
                <th className="num">CPC</th>
                <th className="num">CPM</th>
                <th className="num">Meta purch.</th>
                <th className="num">Meta rev.</th>
                <th className="num">Meta ROAS</th>
                {showOur ? (
                  <>
                    <th className="num">Our rev.</th>
                    <th className="num">Our Meta ROAS</th>
                    <th className="num">NC credit</th>
                    <th className="num">Attr. nCAC</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {platformRows.map((row) => {
                const ours = ourById.get(row.id);
                const ourHref =
                  grain === "adset"
                    ? `/meta/our/adset/${row.id}`
                    : `/meta/our/ad/${row.id}`;
                const ncac = ours
                  ? grainAttributedNcac(row.spend, ours.newCustomerCredit)
                  : null;
                const ourRoas = ours ? grainOurRoas(ours.attributedRevenue, row.spend) : null;
                const nameCell = hrefPrefix ? (
                  <Link className="underline" href={`${hrefPrefix}/${row.id}`}>
                    {row.name}
                  </Link>
                ) : (
                  row.name
                );
                return (
                  <tr key={row.id}>
                    <td className="text-foreground">{nameCell}</td>
                    <td className="font-mono text-xs">{row.id}</td>
                    <td className="num">{row.spend ? money(row.spend) : "—"}</td>
                    <td className="num">{formatNumber(row.impressions)}</td>
                    <td className="num">{formatNumber(row.clicks)}</td>
                    <td className="num">{row.ctr == null ? "—" : `${(row.ctr * 100).toFixed(2)}%`}</td>
                    <td className="num">{row.cpc == null ? "—" : money(row.cpc)}</td>
                    <td className="num">{row.cpm == null ? "—" : money(row.cpm)}</td>
                    <td className="num">{formatNumber(row.purchases)}</td>
                    <td className="num">{money(row.purchaseValue)}</td>
                    <td className="num">{row.roas == null ? "—" : `${row.roas.toFixed(2)}x`}</td>
                    {showOur ? (
                      <>
                        <td className="num">
                          {ours ? (
                            <Link className="underline" href={ourHref}>
                              {money(ours.attributedRevenue)}
                            </Link>
                          ) : (
                            money(0)
                          )}
                        </td>
                        <td className="num">{ourRoas == null ? "—" : `${ourRoas.toFixed(2)}x`}</td>
                        <td className="num">
                          {ours ? formatNumber(Math.round(ours.newCustomerCredit * 100) / 100) : "—"}
                        </td>
                        <td className="num">{ncac == null ? "—" : money(ncac)}</td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
