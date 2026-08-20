"use client";

import Link from "next/link";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { OurCampaignRow } from "@/lib/attribution/campaign-map";
import {
  campaignMappingSummary,
  campaignMappingUiLabel,
  campaignMappingUiStatus,
} from "@/lib/attribution/campaign-map";
import { ShowMoreButton, useShowMore } from "@/components/dashboard/ShowMore";

type OurCampaignTableProps = {
  rows: OurCampaignRow[];
  currencyCode: string;
};

export function OurCampaignTable({ rows, currencyCode }: OurCampaignTableProps) {
  const summary = campaignMappingSummary(rows);
  const uiStatus = campaignMappingUiStatus(summary);
  const showRates = uiStatus === "HAS_HIGH_ID_MAPS";
  const { visible, remaining, showMore } = useShowMore(rows);

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">
        Meta platform vs our campaign attribution
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Meta numbers are Flyweel <strong>platform</strong> facts. OUR credit is
        the existing attribution weight, enriched with first-party Meta IDs
        when present. Join priority: exact campaign ID (HIGH), then unique
        normalized name (PARTIAL, legacy only). Duplicate names stay unmapped.
        Mapping: <strong>{campaignMappingUiLabel(summary)}</strong>
        {showRates
          ? ` · ${summary.exactId} HIGH-ID · ${summary.uniqueName} legacy name · ${summary.unmapped + summary.ambiguous} unmapped`
          : " · percentages hidden until HIGH-ID maps exist"}
        . Attributed nCAC uses fractional new-customer credit only when mapping
        confidence is HIGH or PARTIAL. No-spend nCAC is —.
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
                <th>ID</th>
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
              {visible.map((row) => {
                const ourHref = row.campaignId
                  ? `/meta/our/campaign/${row.campaignId}`
                  : "/meta/our/unmapped/_";
                const mapLabel =
                  row.mappingMethod === "campaign_name_exact_unique"
                    ? "campaign_name_exact_unique (legacy)"
                    : row.mappingMethod;
                return (
                  <tr key={`${row.campaignId ?? row.campaignName}`}>
                    <td className="text-foreground">
                      {row.campaignId ? (
                        <Link prefetch={false} className="underline" href={`/meta/${row.campaignId}`}>
                          {row.campaignName}
                        </Link>
                      ) : (
                        row.campaignName
                      )}
                    </td>
                    <td className="font-mono text-xs">{row.campaignId ?? "—"}</td>
                    <td>{mapLabel}</td>
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
                      <Link prefetch={false} className="underline" href={ourHref}>
                        {formatMoney({ amount: row.ourRevenue, currencyCode })}
                      </Link>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ShowMoreButton remaining={remaining} onMore={showMore} />
    </article>
  );
}
