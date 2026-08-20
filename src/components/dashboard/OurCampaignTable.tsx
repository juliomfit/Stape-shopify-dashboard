"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import {
  campaignMappingBadge,
  campaignMappingSummary,
  displayCampaignName,
  partitionCampaignRows,
  shortenId,
  type OurCampaignRow,
} from "@/lib/attribution/campaign-map";
import { CopyIdButton } from "@/components/dashboard/CopyIdButton";
import { MappingBadge } from "@/components/dashboard/MetaSourceBadges";
import { ShowMoreButton, useShowMore } from "@/components/dashboard/ShowMore";
import { StackList, StackRow, TableOrCards } from "@/components/dashboard/TableOrCards";

type OurCampaignTableProps = {
  rows: OurCampaignRow[];
  currencyCode: string;
};

function campaignHref(row: OurCampaignRow) {
  if (row.campaignId) return `/meta/${encodeURIComponent(row.campaignId)}`;
  return `/meta/our/campaign/${encodeURIComponent(row.campaignName)}`;
}

function ourOrdersHref(row: OurCampaignRow) {
  if (row.campaignId) return `/meta/our/campaign/${encodeURIComponent(row.campaignId)}`;
  return `/meta/our/campaign/${encodeURIComponent(row.campaignName)}`;
}

function money(amount: number, currencyCode: string) {
  return formatMoney({ amount, currencyCode });
}

function roas(value: number | null) {
  return value == null ? "—" : `${value.toFixed(2)}x`;
}

function CampaignDetails({ row, currencyCode }: { row: OurCampaignRow; currencyCode: string }) {
  const badge = campaignMappingBadge(row);
  return (
    <div className="grid gap-2 text-xs text-muted sm:grid-cols-2 lg:grid-cols-3">
      {row.campaignId ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>Flyweel campaign ID</span>
          <span className="font-mono text-foreground">{shortenId(row.campaignId)}</span>
          <CopyIdButton value={row.campaignId} />
        </div>
      ) : (
        <p>No Flyweel campaign ID</p>
      )}
      <p>
        Mapping method <span className="text-foreground">{row.mappingMethod}</span>
      </p>
      <p>
        Confidence <span className="text-foreground">{badge.confidence}</span>
      </p>
      <p>
        Meta purchases <span className="text-foreground">{formatNumber(row.metaPurchases ?? 0)}</span>
      </p>
      <p>
        OUR attributed orders{" "}
        <span className="text-foreground">{formatNumber(Math.round(row.ourOrders * 10) / 10)}</span>
      </p>
      <p>
        Difference %{" "}
        <span className="text-foreground">
          {row.differencePct == null ? "—" : formatPercent(row.differencePct)}
        </span>
      </p>
      <p>
        Attributed nCAC{" "}
        <span className="text-foreground">
          {row.attributedNcac == null ? "—" : money(row.attributedNcac, currencyCode)}
        </span>
      </p>
      <p>
        Impressions <span className="text-foreground">{formatNumber(row.impressions)}</span>
      </p>
      <p>
        Clicks <span className="text-foreground">{formatNumber(row.clicks)}</span>
      </p>
      <p>
        <Link prefetch={false} href={campaignHref(row)} className="text-accent hover:underline">
          View ad sets →
        </Link>
      </p>
    </div>
  );
}

function CampaignRow({
  row,
  currencyCode,
  expanded,
  onToggle,
}: {
  row: OurCampaignRow;
  currencyCode: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const badge = campaignMappingBadge(row);
  const name = displayCampaignName(row.campaignName);
  return (
    <>
      <tr>
        <td className="whitespace-normal max-w-[28rem]">
          <Link prefetch={false} href={campaignHref(row)} className="font-medium text-foreground hover:underline">
            {name}
          </Link>
          <button
            type="button"
            className="mt-1 block text-[11px] text-muted hover:text-foreground"
            onClick={onToggle}
          >
            {expanded ? "Hide details" : "Details"}
          </button>
        </td>
        <td>
          <MappingBadge label={badge.label} confidence={badge.confidence} />
        </td>
        <td className="num">{row.spend ? money(row.spend, currencyCode) : "—"}</td>
        <td className="num">{money(row.metaRevenue ?? 0, currencyCode)}</td>
        <td className="num">
          <Link prefetch={false} href={ourOrdersHref(row)} className="hover:underline">
            {money(row.ourRevenue, currencyCode)}
          </Link>
        </td>
        <td className="num">{roas(row.metaRoas)}</td>
        <td className="num">{roas(row.ourRoas)}</td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={7} className="bg-elevated">
            <CampaignDetails row={row} currencyCode={currencyCode} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function CampaignCards({ rows, currencyCode }: { rows: OurCampaignRow[]; currencyCode: string }) {
  return (
    <StackList>
      {rows.map((row) => {
        const badge = campaignMappingBadge(row);
        return (
          <StackRow key={`${row.campaignId ?? row.campaignName}`} href={campaignHref(row)}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-foreground">{displayCampaignName(row.campaignName)}</p>
              <MappingBadge label={badge.label} confidence={badge.confidence} />
            </div>
            <p className="text-sm text-foreground">
              {money(row.ourRevenue, currencyCode)} OUR ·{" "}
              {formatNumber(Math.round(row.ourOrders * 10) / 10)} orders
            </p>
          </StackRow>
        );
      })}
    </StackList>
  );
}

function CampaignGrid({
  rows,
  currencyCode,
}: {
  rows: OurCampaignRow[];
  currencyCode: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const { visible, remaining, showMore } = useShowMore(rows);
  return (
    <>
      <TableOrCards
        table={
          <table className="dash-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Mapping</th>
                <th className="num">Spend</th>
                <th className="num">Meta revenue</th>
                <th className="num">OUR revenue</th>
                <th className="num">Meta ROAS</th>
                <th className="num">OUR ROAS</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const key = `${row.campaignId ?? row.campaignName}`;
                return (
                  <CampaignRow
                    key={key}
                    row={row}
                    currencyCode={currencyCode}
                    expanded={open === key}
                    onToggle={() => setOpen((current) => (current === key ? null : key))}
                  />
                );
              })}
            </tbody>
          </table>
        }
        cards={<CampaignCards rows={visible} currencyCode={currencyCode} />}
      />
      <ShowMoreButton remaining={remaining} onMore={showMore} />
    </>
  );
}

export function OurCampaignTable({ rows, currencyCode }: OurCampaignTableProps) {
  const summary = campaignMappingSummary(rows);
  const { matched, needsMapping, platformOnly, ourOnly, ambiguous } = partitionCampaignRows(rows);

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Campaign attribution</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Compare Meta-reported campaign performance with GoodsNova first-party attribution.
          </p>
        </div>
        <details className="text-xs text-muted">
          <summary className="cursor-pointer text-accent">About mapping</summary>
          <p className="mt-2 max-w-lg leading-5">
            Exact native Meta campaign ID is HIGH. Unique canonical name (URL-decoded) is PARTIAL.
            Flyweel campaign IDs are internal UUIDs, not Meta <code>{"{{campaign.id}}"}</code>. Duplicate
            names stay unmapped. Mapping does not change attribution weights.
          </p>
        </details>
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          Appears when Meta campaign facts or OUR campaign credit exist for this range.
        </p>
      ) : (
        <div className="mt-5 space-y-8">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Matched campaigns</h3>
            <div className="mt-3">
              {matched.length ? (
                <CampaignGrid rows={matched} currencyCode={currencyCode} />
              ) : (
                <p className="text-sm text-muted">No matched campaigns in this range.</p>
              )}
            </div>
          </div>
          {needsMapping.length ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Needs mapping ({needsMapping.length})
              </summary>
              <div className="mt-4 space-y-6">
                {platformOnly.length ? (
                  <section>
                    <h4 className="text-xs uppercase tracking-wide text-muted">Platform only</h4>
                    <div className="mt-2">
                      <CampaignGrid rows={platformOnly} currencyCode={currencyCode} />
                    </div>
                  </section>
                ) : null}
                {ourOnly.length ? (
                  <section>
                    <h4 className="text-xs uppercase tracking-wide text-muted">OUR attribution only</h4>
                    <div className="mt-2">
                      <CampaignGrid rows={ourOnly} currencyCode={currencyCode} />
                    </div>
                  </section>
                ) : null}
                {ambiguous.length ? (
                  <section>
                    <h4 className="text-xs uppercase tracking-wide text-muted">Ambiguous</h4>
                    <div className="mt-2">
                      <CampaignGrid rows={ambiguous} currencyCode={currencyCode} />
                    </div>
                  </section>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      )}
      <p className="mt-4 text-[11px] text-muted">
        {summary.exactId} exact ID · {summary.uniqueName} name match · {summary.unmapped + summary.ambiguous} unmapped
      </p>
    </article>
  );
}
