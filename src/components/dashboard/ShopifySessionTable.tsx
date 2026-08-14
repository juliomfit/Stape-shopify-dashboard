import { formatNumber } from "@/lib/format";
import type { ShopifyqlSessionPoint } from "@/lib/shopify/get-shopify-attribution";

type ShopifySessionTableProps = {
  points: ShopifyqlSessionPoint[];
  error: string | null;
};

export function ShopifySessionTable({ points, error }: ShopifySessionTableProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Shopify sessions by hour
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Shopify storefront sessions, not Stape. Do not use these as the Overview
        conversion denominator.
      </p>
      {error && points.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{error}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="dash-table min-w-[32rem]">
            <thead>
              <tr>
                <th>Hour</th>
                <th>Channel</th>
                <th>Type</th>
                <th className="num">Shopify sessions</th>
              </tr>
            </thead>
            <tbody>
              {points.length === 0 ? (
                <tr>
                  <td className="text-muted" colSpan={4}>
                    No Shopify session rows.
                  </td>
                </tr>
              ) : (
                points.slice(0, 120).map((point, index) => (
                  <tr
                    key={`${point.hour}-${point.channel}-${point.type}-${index}`}
                  >
                    <td className="text-muted">{point.hour || "—"}</td>
                    <td className="text-foreground">{point.channel}</td>
                    <td className="text-muted">{point.type}</td>
                    <td className="num text-muted">
                      {formatNumber(point.sessions)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
