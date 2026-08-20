"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { EntityRollup } from "@/lib/ads/meta-query";
import { EmptyTable, type EmptyNext } from "@/components/dashboard/EmptyTable";
import { ShowMoreButton, useShowMore } from "@/components/dashboard/ShowMore";

type SortKey = keyof Pick<
  EntityRollup,
  "name" | "spend" | "purchases" | "purchaseValue" | "roas" | "cpa" | "impressions" | "reach" | "frequency" | "cpm" | "clicks" | "ctr" | "cpc"
>;

function money(amount: number, currency: string) {
  return formatMoney({ amount, currencyCode: currency });
}

export function MetaEntityTable({
  rows,
  hrefPrefix,
  currency = "USD",
  emptyTitle = "No Meta rows",
  emptyWhy = "No Meta insights for this period. Flyweel ingest is campaign-level; Today is often $0 until Ads Manager closes the day.",
  emptyNext = [
    { kind: "range", range: "yesterday", label: "Yesterday" },
    { kind: "range", range: "7d", label: "7d" },
    { kind: "href", href: "/meta", label: "Refresh Meta" },
  ],
}: {
  rows: EntityRollup[];
  hrefPrefix?: string;
  currency?: string;
  emptyTitle?: string;
  emptyWhy?: string;
  emptyNext?: EmptyNext[];
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("spend");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = rows.filter((row) => !q || row.name.toLowerCase().includes(q) || row.id.includes(q));
    next.sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      if (typeof av === "string" || typeof bv === "string") {
        return dir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      }
      const an = av === null || av === undefined ? -Infinity : Number(av);
      const bn = bv === null || bv === undefined ? -Infinity : Number(bv);
      return dir === "asc" ? an - bn : bn - an;
    });
    return next;
  }, [rows, query, sort, dir]);
  const { visible, remaining, showMore } = useShowMore(filtered);

  function header(key: SortKey, label: string) {
    return (
      <th className="py-2 pr-3 font-medium">
        <button
          type="button"
          className="text-left"
          onClick={() => {
            if (sort === key) {
              setDir(dir === "asc" ? "desc" : "asc");
            } else {
              setSort(key);
              setDir(key === "name" ? "asc" : "desc");
            }
          }}
        >
          {label}
          {sort === key ? (dir === "asc" ? " ↑" : " ↓") : ""}
        </button>
      </th>
    );
  }

  if (rows.length === 0) {
    return <EmptyTable title={emptyTitle} why={emptyWhy} next={emptyNext} />;
  }

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name or ID"
        className="w-full max-w-sm rounded-lg border border-border px-3 py-2 text-sm"
      />
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              {header("name", "Name")}
              {header("spend", "Spend")}
              {header("purchaseValue", "Purchase value")}
              {header("purchases", "Purchases")}
              {header("roas", "ROAS")}
              {header("cpa", "CPA")}
              {header("impressions", "Impr.")}
              {header("reach", "Reach")}
              {header("frequency", "Freq.")}
              {header("cpm", "CPM")}
              {header("clicks", "Clicks")}
              {header("ctr", "CTR")}
              {header("cpc", "CPC")}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const href = hrefPrefix ? `${hrefPrefix.replace(/\/$/, "")}/${row.id}` : null;
              const name = href ? (
                <Link prefetch={false} href={href} className="font-medium text-foreground underline">
                  {row.name}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{row.name}</span>
              );
              return (
                <tr key={row.id} className="border-b border-border/70">
                  <td className="py-2 pr-3">{name}</td>
                  <td className="py-2 pr-3">{money(row.spend, currency)}</td>
                  <td className="py-2 pr-3">{money(row.purchaseValue, currency)}</td>
                  <td className="py-2 pr-3">{formatNumber(row.purchases)}</td>
                  <td className="py-2 pr-3">{row.roas === null ? "—" : `${row.roas.toFixed(2)}x`}</td>
                  <td className="py-2 pr-3">{row.cpa === null ? "—" : money(row.cpa, currency)}</td>
                  <td className="py-2 pr-3">{formatNumber(row.impressions)}</td>
                  <td className="py-2 pr-3">{formatNumber(row.reach)}</td>
                  <td className="py-2 pr-3">{row.frequency.toFixed(2)}</td>
                  <td className="py-2 pr-3">{row.cpm === null ? "—" : money(row.cpm, currency)}</td>
                  <td className="py-2 pr-3">{formatNumber(row.clicks)}</td>
                  <td className="py-2 pr-3">{row.ctr === null ? "—" : formatPercent(row.ctr)}</td>
                  <td className="py-2">{row.cpc === null ? "—" : money(row.cpc, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ShowMoreButton remaining={remaining} onMore={showMore} />
    </div>
  );
}
