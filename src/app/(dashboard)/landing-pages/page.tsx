import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { Header } from "@/components/layout/Header";
import { formatNumber } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { DEFAULT_LOOKBACK } from "@/lib/warehouse/constants";
import { getWarehouseMetrics } from "@/lib/warehouse/get-warehouse-metrics";


export const metadata: Metadata = {
  title: "Landing pages",
};

export default async function LandingPagesPage() {
  const [warehouse, shopify] = await Promise.all([
    getWarehouseMetrics({ lookbackDays: DEFAULT_LOOKBACK }),
    getShopifyOverviewMetrics(),
  ]);

  return (
    <>
      <Header
        title="Landing pages"
        description="Warehouse GA4 sessions by landing page × channel. Dual Data Client copies are excluded from session keys. ROAS is omitted unless spend maps to the page."
      />
      <section className="dash-page gap-6">
        <ConnectionStatus shopify={shopify.status} stape={warehouse.status} />
        <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
          <h2 className="text-sm font-semibold text-foreground">
            Landing page × channel
          </h2>
          <p className="mt-1 text-xs text-muted">
            Sessions in the selected header range. Product ad-spend is not
            allocated to a URL.
          </p>
          {warehouse.landings.length === 0 ? (
            <p className="mt-6 text-sm text-muted">
              Landing pages appear once BigQuery sessions are available.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="dash-table min-w-[40rem]">
                <thead>
                  <tr>
                    <th>Landing page</th>
                    <th>Channel</th>
                    <th className="num">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouse.landings.map((row) => (
                    <tr key={`${row.landingPage}-${row.channel}`}>
                      <td className="max-w-md truncate text-foreground">
                        {row.landingPage}
                      </td>
                      <td>{row.channel}</td>
                      <td className="num">{formatNumber(row.sessions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
