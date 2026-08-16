import { formatMoney, formatNumber, formatPercent } from "@/lib/format";

export function Ga4CaptureCompare({
  shopifyOrders,
  shopifyRevenue,
  stapePurchases,
  stapeRevenue,
  ga4Purchases,
  ga4Revenue,
  ga4Sessions,
  currencyCode,
  periodLabel,
  propertyId,
  streamId,
  hasRows,
}: {
  shopifyOrders: number | null;
  shopifyRevenue: number | null;
  stapePurchases: number | null;
  stapeRevenue: number | null;
  ga4Purchases: number | null;
  ga4Revenue: number | null;
  ga4Sessions: number | null;
  currencyCode: string;
  periodLabel: string;
  propertyId: string;
  streamId: string;
  hasRows: boolean;
}) {
  const money = (value: number | null) =>
    value === null ? "—" : formatMoney({ amount: value, currencyCode });
  const count = (value: number | null) => (value === null ? "—" : formatNumber(value));

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">GA4 vs Shopify vs Stape</h2>
      <p className="mt-1 text-xs text-muted">
        Same header period ({periodLabel}). GA4 is Google Analytics, not gn_* first-touch
        {propertyId ? ` · property ${propertyId}` : ""}
        {streamId ? ` · stream ${streamId}` : " · all streams"}. Missing warehouse rows stay —.
      </p>
      {!hasRows ? (
        <p className="mt-4 text-sm text-muted">
          No GA4 warehouse rows for these dates. Enable Analytics Data API, then Refresh GA4.
        </p>
      ) : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="pb-2 pr-3 font-medium">Source</th>
              <th className="pb-2 pr-3 font-medium">Sessions</th>
              <th className="pb-2 pr-3 font-medium">Purchases / orders</th>
              <th className="pb-2 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="py-2 pr-3 font-medium">Shopify</td>
              <td className="py-2 pr-3 text-muted">—</td>
              <td className="py-2 pr-3 text-muted">{count(shopifyOrders)}</td>
              <td className="py-2 text-muted">{money(shopifyRevenue)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-2 pr-3 font-medium">Stape / sGTM</td>
              <td className="py-2 pr-3 text-muted">—</td>
              <td className="py-2 pr-3 text-muted">{count(stapePurchases)}</td>
              <td className="py-2 text-muted">{money(stapeRevenue)}</td>
            </tr>
            <tr>
              <td className="py-2 pr-3 font-medium">GA4</td>
              <td className="py-2 pr-3 text-muted">{count(ga4Sessions)}</td>
              <td className="py-2 pr-3 text-muted">{count(ga4Purchases)}</td>
              <td className="py-2 text-muted">{money(ga4Revenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function Ga4BreakdownPanel({
  title,
  description,
  rows,
  extraLabel,
}: {
  title: string;
  description: string;
  rows: { label: string; sessions: number; extra?: number }[];
  extraLabel?: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs text-muted">{description}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No GA4 rows. Refresh GA4 for this header range.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span className="min-w-0 truncate text-foreground">{row.label}</span>
              <span className="shrink-0 text-muted">
                {formatNumber(row.sessions)} sessions
                {extraLabel && row.extra
                  ? ` · ${extraLabel} ${formatNumber(row.extra)}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function Ga4EngagementStrip({
  totals,
  periodLabel,
}: {
  totals: {
    engagedSessions: number;
    engagementRate: number;
    bounceRate: number;
    newUsers: number;
    addToCarts: number;
    checkouts: number;
    views: number;
    sessions: number;
  };
  periodLabel: string;
}) {
  const items = [
    { label: "GA4 sessions", value: formatNumber(totals.sessions) },
    { label: "Engaged sessions", value: formatNumber(totals.engagedSessions) },
    {
      label: "Engagement rate",
      value: totals.sessions ? formatPercent(totals.engagementRate) : "—",
    },
    { label: "Bounce rate", value: totals.sessions ? formatPercent(totals.bounceRate) : "—" },
    { label: "New users", value: formatNumber(totals.newUsers) },
    { label: "Add to carts", value: formatNumber(totals.addToCarts) },
    { label: "Checkouts", value: formatNumber(totals.checkouts) },
    { label: "Views", value: formatNumber(totals.views) },
  ];

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">GA4 engagement / ecommerce</h2>
      <p className="mt-1 text-xs text-muted">
        Google Analytics · {periodLabel} · not Shopify and not gn_*
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted">{item.label}</dt>
            <dd className="text-sm font-medium text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
