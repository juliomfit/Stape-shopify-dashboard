"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { OrderAttributionDebugger } from "@/components/dashboard/OrderAttributionDebugger";
import { journeyStats } from "@/lib/attribution/journey";
import type { AttributedOrder } from "@/lib/stape/attribution-types";
import { formatMoney, formatNumber } from "@/lib/format";
import { ShowMoreButton, useShowMore } from "@/components/dashboard/ShowMore";

type JourneyExplorerProps = {
  orders: AttributedOrder[];
  lookbackDays: number;
  currencyCode: string;
};

type SortKey = "revenue" | "touches" | "lag";

export function JourneyExplorer({
  orders,
  lookbackDays,
  currencyCode,
}: JourneyExplorerProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const withStats = orders.map((order) => ({ order, stats: journeyStats(order) }));
    const filtered = query.trim()
      ? withStats.filter(({ order }) =>
          order.transactionId.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : withStats;
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "touches") {
        return b.stats.touchCount - a.stats.touchCount;
      }
      if (sortKey === "lag") {
        return (b.stats.daysToConversion ?? 0) - (a.stats.daysToConversion ?? 0);
      }
      return b.order.revenue - a.order.revenue;
    });
    return sorted;
  }, [orders, sortKey, query]);
  const { visible, remaining, showMore } = useShowMore(rows);

  if (orders.length === 0) {
    return (
      <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Customer journeys</h2>
        <p className="mt-2 text-sm text-muted">
          Attributed order journeys appear here once Stape / BigQuery is
          connected and purchase events with a stitched person key are present
          for the selected range.
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          Customer journeys · {formatNumber(orders.length)} attributed orders
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search transaction ID"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Sort
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="revenue">Revenue</option>
              <option value="touches">Touch count</option>
              <option value="lag">Days to conversion</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="dash-table min-w-[46rem]">
          <thead>
            <tr>
              <th>Order</th>
              <th>Revenue</th>
              <th>First touch</th>
              <th>Last non-direct</th>
              <th className="num">Touches</th>
              <th className="num">Days to convert</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ order, stats }) => {
              const isOpen = expanded === order.transactionId;
              return (
                <Fragment key={order.transactionId}>
                  <tr
                    className="cursor-pointer"
                    onClick={() =>
                      setExpanded(isOpen ? null : order.transactionId)
                    }
                  >
                    <td className="flex items-center gap-1.5 text-foreground">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                      )}
                      <span className="font-mono text-xs">{order.transactionId}</span>
                    </td>
                    <td>{formatMoney({ amount: order.revenue, currencyCode })}</td>
                    <td className="text-muted">{stats.firstChannel ?? "—"}</td>
                    <td className="text-muted">{order.lastNonDirect}</td>
                    <td className="num">{formatNumber(stats.touchCount)}</td>
                    <td className="num">
                      {stats.daysToConversion === null
                        ? "—"
                        : stats.daysToConversion.toFixed(1)}
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={6} className="bg-elevated/40">
                        <OrderAttributionDebugger
                          order={order}
                          lookbackDays={lookbackDays}
                          currencyCode={currencyCode}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <ShowMoreButton remaining={remaining} onMore={showMore} />
    </article>
  );
}
