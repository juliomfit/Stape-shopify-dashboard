import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { EmptyTable } from "@/components/dashboard/EmptyTable";
import { getCreativePerformance } from "@/lib/ads/meta-query";
import { getSelectedPeriod } from "@/lib/period-server";
import { getDashboardPeriod } from "@/lib/period";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Meta creatives" };

export default async function MetaCreativesPage() {
  const period = await getSelectedPeriod();
  let rows = await getCreativePerformance(period).catch(() => []);
  let rangeNote = "";
  if (rows.length === 0 && period.dayCount <= 1) {
    rows = await getCreativePerformance(getDashboardPeriod("7d")).catch(() => []);
    if (rows.length) {
      rangeNote =
        "Today has no campaign spend in the warehouse yet, so this table is last 7 days. Click 7d in the header to match the cards.";
    }
  }

  return (
    <>
      <Header
        title="Meta creatives"
        description="Campaign-level performance from the warehouse when Flyweel is the provider. Thumbnails need Meta Graph. Not a live Flyweel call."
      />
      <section className="dash-page gap-6">
        {rangeNote ? <p className="text-sm text-amber-900">{rangeNote}</p> : null}
        {rows.length === 0 ? (
          <EmptyTable
            title="No campaign spend in this range"
            why="Flyweel does not send creative thumbnails. This table falls back to campaign warehouse spend/CPA. Today is often $0 while Yesterday has spend — that is Flyweel lag, not a missing dataset."
            next={[
              { kind: "range", range: "yesterday", label: "Yesterday" },
              { kind: "range", range: "7d", label: "7d" },
              { kind: "href", href: "/meta", label: "Refresh Meta" },
            ]}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="py-2 pr-3">Campaign / creative</th>
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Ad</th>
                  <th className="py-2 pr-3">Spend</th>
                  <th className="py-2 pr-3">Purchases</th>
                  <th className="py-2 pr-3">CPA</th>
                  <th className="py-2 pr-3">ROAS</th>
                  <th className="py-2 pr-3">CTR</th>
                  <th className="py-2 pr-3">First seen</th>
                  <th className="py-2">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.creativeId} className="border-b border-border/70">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        {row.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.thumbnailUrl} alt="" className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <span className="inline-block h-10 w-10 rounded bg-slate-100" />
                        )}
                        <Link href={`/meta/${row.creativeId}`} className="hover:underline">
                          {row.name}
                        </Link>
                      </div>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.creativeId}</td>
                    <td className="py-2 pr-3">{row.adName || "—"}</td>
                    <td className="py-2 pr-3">{formatMoney({ amount: row.spend, currencyCode: "USD" })}</td>
                    <td className="py-2 pr-3">{formatNumber(row.purchases)}</td>
                    <td className="py-2 pr-3">
                      {row.cpa === null ? "—" : formatMoney({ amount: row.cpa, currencyCode: "USD" })}
                    </td>
                    <td className="py-2 pr-3">{row.roas === null ? "—" : `${row.roas.toFixed(2)}x`}</td>
                    <td className="py-2 pr-3">{row.ctr === null ? "—" : formatPercent(row.ctr)}</td>
                    <td className="py-2 pr-3">{row.firstSeen || "—"}</td>
                    <td className="py-2">{row.lastSeen || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AskAiPanel viewContext={`Meta creatives · ${period.label}`} />
      </section>
    </>
  );
}
