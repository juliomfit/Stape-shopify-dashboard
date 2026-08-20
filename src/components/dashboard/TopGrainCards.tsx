import { formatMoney, formatNumber } from "@/lib/format";

export function TopGrainCards({
  topAdset,
  topAd,
  currencyCode,
}: {
  topAdset: { label: string; revenue: number; orders: number } | null;
  topAd: { label: string; revenue: number; orders: number } | null;
  currencyCode: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Top Ad Set by OUR Revenue</p>
        {topAdset ? (
          <>
            <p className="mt-2 text-lg font-semibold text-foreground">{topAdset.label}</p>
            <p className="mt-1 text-sm text-foreground">
              {formatMoney({ amount: topAdset.revenue, currencyCode })} OUR revenue
            </p>
            <p className="text-xs text-muted">{formatNumber(Math.round(topAdset.orders * 10) / 10)} attributed orders</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">No observed ad-set IDs in this range.</p>
        )}
      </article>
      <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Top Ad by OUR Revenue</p>
        {topAd ? (
          <>
            <p className="mt-2 text-lg font-semibold text-foreground">{topAd.label}</p>
            <p className="mt-1 text-sm text-foreground">
              {formatMoney({ amount: topAd.revenue, currencyCode })} OUR revenue
            </p>
            <p className="text-xs text-muted">{formatNumber(Math.round(topAd.orders * 10) / 10)} attributed orders</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">No observed ad IDs in this range.</p>
        )}
      </article>
    </div>
  );
}
