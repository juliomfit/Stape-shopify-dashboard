import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { OurCampaignRow } from "@/lib/attribution/campaign-map";
import { CAMPAIGN_MAPPING_STATUS } from "@/lib/attribution/campaign-map";

type OurCampaignTableProps = {
  rows: OurCampaignRow[];
  currencyCode: string;
};

export function OurCampaignTable({ rows, currencyCode }: OurCampaignTableProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">
        Meta platform vs our campaign attribution
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Meta numbers are Flyweel <strong>platform</strong> facts (Campaign → Ad
        Set → Ad → Creative). OUR first-party attribution grain is campaign
        (UTM / campaign id) only — ad-set/ad/creative are not independent OUR
        credits. Join priority: exact campaign ID, then exact unique normalized
        name. Duplicate names stay unmapped. Mapping coverage:{" "}
        {CAMPAIGN_MAPPING_STATUS} (run{" "}
        <span className="font-mono">
          bigquery/validation/05_meta_campaign_mapping_coverage.sql
        </span>
        ). Attributed nCAC uses fractional new-customer credit only when mapping
        confidence is HIGH or PARTIAL.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          Appears when Meta campaign facts or OUR campaign credit exist for this
          range.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="dash-table min-w-[64rem]">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Map</th>
                <th>Confidence</th>
                <th className="num">Spend</th>
                <th className="num">Meta revenue</th>
                <th className="num">Our revenue</th>
                <th className="num">Δ %</th>
                <th className="num">Meta ROAS</th>
                <th className="num">Our campaign ROAS</th>
                <th className="num">Our orders</th>
                <th className="num">Attr. nCAC</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.campaignId ?? row.campaignName}`}>
                  <td className="text-foreground">{row.campaignName}</td>
                  <td>{row.mappingMethod}</td>
                  <td>{row.mappingConfidence}</td>
                  <td className="num">
                    {row.spend
                      ? formatMoney({ amount: row.spend, currencyCode })
                      : "—"}
                  </td>
                  <td className="num">
                    {formatMoney({ amount: row.metaRevenue, currencyCode })}
                  </td>
                  <td className="num">
                    {formatMoney({ amount: row.ourRevenue, currencyCode })}
                  </td>
                  <td className="num">
                    {row.differencePct === null
                      ? "—"
                      : formatPercent(row.differencePct)}
                  </td>
                  <td className="num">
                    {row.metaRoas === null ? "—" : `${row.metaRoas.toFixed(2)}x`}
                  </td>
                  <td className="num">
                    {row.ourRoas === null ? "—" : `${row.ourRoas.toFixed(2)}x`}
                  </td>
                  <td className="num">
                    {formatNumber(Math.round(row.ourOrders * 10) / 10)}
                  </td>
                  <td className="num">
                    {row.attributedNcac === null
                      ? "—"
                      : formatMoney({
                          amount: row.attributedNcac,
                          currencyCode,
                        })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
