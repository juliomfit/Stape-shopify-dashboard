import Link from "next/link";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { CopyIdButton } from "@/components/dashboard/CopyIdButton";
import { FirstPartyIdBadge, FirstPartySourceLabel } from "@/components/dashboard/MetaSourceBadges";
import { StackList, StackRow, TableOrCards } from "@/components/dashboard/TableOrCards";
import { shortenId } from "@/lib/attribution/campaign-map";
import type {
  ObservedMetaAdRollup,
  ObservedMetaAdsetRollup,
  ObservedUnmappedBucket,
} from "@/lib/attribution/observed-meta-grain";

function money(amount: number, currencyCode: string) {
  return formatMoney({ amount, currencyCode });
}

function UnmappedRow({
  bucket,
  currencyCode,
}: {
  bucket: ObservedUnmappedBucket;
  currencyCode: string;
}) {
  if (!(bucket.attributedRevenue > 0 || bucket.attributedOrders > 0)) return null;
  return (
    <tr>
      <td className="whitespace-normal text-muted">{bucket.label}</td>
      <td className="num">{money(bucket.attributedRevenue, currencyCode)}</td>
      <td className="num">{formatNumber(Math.round(bucket.attributedOrders * 10) / 10)}</td>
      <td className="num">{formatNumber(Math.round(bucket.newCustomerCredit * 100) / 100)}</td>
      <td className="num">—</td>
    </tr>
  );
}

export function ObservedAdsetTable({
  adsets,
  unidentified,
  conflict,
  currencyCode,
  parentRevenue,
}: {
  adsets: ObservedMetaAdsetRollup[];
  unidentified: ObservedUnmappedBucket;
  conflict: ObservedUnmappedBucket;
  currencyCode: string;
  parentRevenue: number;
}) {
  const href = (id: string) => `/meta/our/adset/${encodeURIComponent(id)}`;
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Ad sets</h2>
          <FirstPartySourceLabel extra="Flyweel does not provide ad-set spend." />
        </div>
      </div>
      {adsets.length === 0 && unidentified.attributedRevenue <= 0 && conflict.attributedRevenue <= 0 ? (
        <p className="mt-6 text-sm text-muted">No first-party ad-set IDs captured for this campaign in the selected range.</p>
      ) : (
        <TableOrCards
          table={
            <table className="dash-table mt-4">
              <thead>
                <tr>
                  <th>Ad Set</th>
                  <th className="num">OUR Revenue</th>
                  <th className="num">Attributed orders</th>
                  <th className="num">New Customer Credit</th>
                  <th className="num">Share of Campaign</th>
                </tr>
              </thead>
              <tbody>
                {adsets.map((row) => (
                  <tr key={row.adsetId}>
                    <td className="whitespace-normal">
                      <Link prefetch={false} href={href(row.adsetId)} className="font-medium text-foreground hover:underline">
                        {row.adsetLabel}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                        {shortenId(row.adsetId)}
                        <CopyIdButton value={row.adsetId} />
                        <FirstPartyIdBadge />
                      </div>
                    </td>
                    <td className="num">{money(row.attributedRevenue, currencyCode)}</td>
                    <td className="num">{formatNumber(Math.round(row.attributedOrders * 10) / 10)}</td>
                    <td className="num">{formatNumber(Math.round(row.newCustomerCredit * 100) / 100)}</td>
                    <td className="num">
                      {formatPercent(parentRevenue > 0 ? row.attributedRevenue / parentRevenue : row.shareOfParentRevenue)}
                    </td>
                  </tr>
                ))}
                <UnmappedRow bucket={unidentified} currencyCode={currencyCode} />
                <UnmappedRow bucket={conflict} currencyCode={currencyCode} />
              </tbody>
            </table>
          }
          cards={
            <StackList>
              {adsets.map((row) => (
                <StackRow key={row.adsetId} href={href(row.adsetId)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{row.adsetLabel}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted">{shortenId(row.adsetId)}</p>
                    </div>
                    <FirstPartyIdBadge />
                  </div>
                  <p className="text-sm text-foreground">
                    {money(row.attributedRevenue, currencyCode)} ·{" "}
                    {formatNumber(Math.round(row.attributedOrders * 10) / 10)} orders
                  </p>
                </StackRow>
              ))}
            </StackList>
          }
        />
      )}
    </article>
  );
}

export function ObservedAdTable({
  ads,
  unidentified,
  conflict,
  currencyCode,
  parentRevenue,
}: {
  ads: ObservedMetaAdRollup[];
  unidentified: ObservedUnmappedBucket;
  conflict: ObservedUnmappedBucket;
  currencyCode: string;
  parentRevenue: number;
}) {
  const href = (id: string) => `/meta/our/ad/${encodeURIComponent(id)}`;
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">Ads</h2>
      <FirstPartySourceLabel extra="Flyweel does not provide ad-level spend." />
      {ads.length === 0 && unidentified.attributedRevenue <= 0 && conflict.attributedRevenue <= 0 ? (
        <p className="mt-6 text-sm text-muted">No first-party ad IDs captured for this ad set in the selected range.</p>
      ) : (
        <TableOrCards
          table={
            <table className="dash-table mt-4">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th className="num">OUR Revenue</th>
                  <th className="num">Attributed orders</th>
                  <th className="num">New Customer Credit</th>
                  <th className="num">Share of Ad Set</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((row) => (
                  <tr key={row.adId}>
                    <td className="whitespace-normal">
                      <Link prefetch={false} href={href(row.adId)} className="font-medium text-foreground hover:underline">
                        {row.adLabel}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                        {shortenId(row.adId)}
                        <CopyIdButton value={row.adId} />
                        <FirstPartyIdBadge />
                      </div>
                    </td>
                    <td className="num">{money(row.attributedRevenue, currencyCode)}</td>
                    <td className="num">{formatNumber(Math.round(row.attributedOrders * 10) / 10)}</td>
                    <td className="num">{formatNumber(Math.round(row.newCustomerCredit * 100) / 100)}</td>
                    <td className="num">
                      {formatPercent(parentRevenue > 0 ? row.attributedRevenue / parentRevenue : row.shareOfAdsetRevenue)}
                    </td>
                  </tr>
                ))}
                <UnmappedRow bucket={unidentified} currencyCode={currencyCode} />
                <UnmappedRow bucket={conflict} currencyCode={currencyCode} />
              </tbody>
            </table>
          }
          cards={
            <StackList>
              {ads.map((row) => (
                <StackRow key={row.adId} href={href(row.adId)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{row.adLabel}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted">{shortenId(row.adId)}</p>
                    </div>
                    <FirstPartyIdBadge />
                  </div>
                  <p className="text-sm text-foreground">
                    {money(row.attributedRevenue, currencyCode)} ·{" "}
                    {formatNumber(Math.round(row.attributedOrders * 10) / 10)} orders
                  </p>
                </StackRow>
              ))}
            </StackList>
          }
        />
      )}
    </article>
  );
}
