import { ChannelLabel, TypeBadge } from "@/components/dashboard/ChannelMark";
import { formatNumber } from "@/lib/format";
import type { ShopifyqlSessionPoint } from "@/lib/shopify/get-shopify-attribution";
import {
  StackList,
  StackRow,
  TableOrCards,
} from "@/components/dashboard/TableOrCards";

type ShopifySessionTableProps = {
  points: ShopifyqlSessionPoint[];
  error: string | null;
};

export function ShopifySessionTable({ points, error }: ShopifySessionTableProps) {
  const visible = points.slice(0, 120);
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
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
        <div className="mt-4">
          <TableOrCards
            cards={
              visible.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">No Shopify session rows.</p>
              ) : (
                <StackList>
                  {visible.map((point, index) => (
                    <StackRow
                      key={`${point.hour}-${point.channel}-${point.type}-${index}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <ChannelLabel name={point.channel} type={point.type} />
                          <p className="mt-1 text-xs text-muted">
                            {point.hour || "—"}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatNumber(point.sessions)}
                        </span>
                      </div>
                    </StackRow>
                  ))}
                </StackList>
              )
            }
            table={
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
                  {visible.length === 0 ? (
                    <tr>
                      <td className="text-muted" colSpan={4}>
                        No Shopify session rows.
                      </td>
                    </tr>
                  ) : (
                    visible.map((point, index) => (
                      <tr
                        key={`${point.hour}-${point.channel}-${point.type}-${index}`}
                      >
                        <td className="text-muted">{point.hour || "—"}</td>
                        <td>
                          <ChannelLabel name={point.channel} type={point.type} />
                        </td>
                        <td>
                          <TypeBadge type={point.type} />
                        </td>
                        <td className="num text-muted">
                          {formatNumber(point.sessions)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            }
          />
        </div>
      )}
    </article>
  );
}
