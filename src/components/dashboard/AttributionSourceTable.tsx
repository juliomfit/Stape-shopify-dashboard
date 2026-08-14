"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatNumber } from "@/lib/format";
import type { FirstTouchGroupBy, FirstTouchRollup } from "@/lib/shopify/first-touch";

type AttributionSourceTableProps = {
  currencyCode: string;
  periodLabel: string;
  byChannel: FirstTouchRollup[];
  bySourceMedium: FirstTouchRollup[];
  byCampaign: FirstTouchRollup[];
  sourceMediumSpendNote?: string | null;
};

const GROUPS: { key: FirstTouchGroupBy; label: string }[] = [
  { key: "source_medium", label: "Source / medium" },
  { key: "channel", label: "Channel" },
  { key: "campaign", label: "Campaign" },
];

function dashMoney(
  amount: number | null,
  currencyCode: string,
) {
  if (amount === null) {
    return "—";
  }

  return formatMoney({ amount, currencyCode });
}

function dashRoas(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}x`;
}

export function AttributionSourceTable({
  currencyCode,
  periodLabel,
  byChannel,
  bySourceMedium,
  byCampaign,
  sourceMediumSpendNote = null,
}: AttributionSourceTableProps) {
  const [group, setGroup] = useState<FirstTouchGroupBy>("source_medium");
  const rows = useMemo(() => {
    if (group === "channel") {
      return byChannel;
    }
    if (group === "campaign") {
      return byCampaign;
    }
    return bySourceMedium;
  }, [group, byChannel, byCampaign, bySourceMedium]);

  const highlightEconomics = rows.some((row) => row.spend !== null);
  const totals = useMemo(() => {
    const withSpend = rows.filter((row) => row.spend !== null);
    const spendParts = withSpend
      .map((row) => row.spend)
      .filter((value): value is number => value !== null);
    const spend = spendParts.length > 0 ? spendParts.reduce((a, b) => a + b, 0) : null;
    const spendRevenue = withSpend.reduce((sum, row) => sum + row.revenue, 0);
    const spendPaidOrders = withSpend.reduce((sum, row) => sum + row.paidOrders, 0);
    const spendNewOrders = withSpend.reduce(
      (sum, row) => sum + row.newCustomerOrders,
      0,
    );
    const spendNewRevenue = withSpend.reduce(
      (sum, row) => sum + row.newCustomerRevenue,
      0,
    );

    return {
      orders: rows.reduce((sum, row) => sum + row.orders, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
      newCustomerOrders: rows.reduce((sum, row) => sum + row.newCustomerOrders, 0),
      newCustomerRevenue: rows.reduce(
        (sum, row) => sum + row.newCustomerRevenue,
        0,
      ),
      repeatOrders: rows.reduce((sum, row) => sum + row.repeatOrders, 0),
      spend,
      roas: spend && spend > 0 ? spendRevenue / spend : null,
      newCustomerRoas: spend && spend > 0 ? spendNewRevenue / spend : null,
      cpa: spend && spendPaidOrders > 0 ? spend / spendPaidOrders : null,
      ncCpa: spend && spendNewOrders > 0 ? spend / spendNewOrders : null,
    };
  }, [rows]);

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            First-touch source / medium
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            gn_* on the Shopify order · {periodLabel}. Unknown is missing stitch,
            not Direct. Spend and ROAS only when that row has real Meta or Google
            totals for these dates.
          </p>
        </div>
        <div className="flex flex-wrap rounded-lg border border-border bg-background p-1">
          {GROUPS.map((item) => {
            const active = group === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setGroup(item.key);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  active
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      {group === "source_medium" && sourceMediumSpendNote ? (
        <p className="mt-3 text-xs leading-5 text-muted">{sourceMediumSpendNote}</p>
      ) : null}
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No orders in this range.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="dash-table min-w-[56rem]">
            <thead>
              <tr>
                <th>Source</th>
                <th>Medium</th>
                <th className="num">Orders</th>
                <th className="num">Revenue</th>
                <th className="num">New orders</th>
                <th className="num">New revenue</th>
                <th className="num">Repeat orders</th>
                <th className="num">Spend</th>
                <th className={`num ${highlightEconomics ? "bg-accent-soft" : ""}`}>
                  ROAS
                </th>
                <th className={`num ${highlightEconomics ? "bg-accent-soft" : ""}`}>
                  NC ROAS
                </th>
                <th className="num">CPA</th>
                <th className="num">NC CPA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="font-medium text-foreground">{row.source}</td>
                  <td className="text-muted">{row.medium}</td>
                  <td className="num text-muted">{formatNumber(row.orders)}</td>
                  <td className="num text-muted">
                    {formatMoney({ amount: row.revenue, currencyCode })}
                  </td>
                  <td className="num text-muted">
                    {formatNumber(row.newCustomerOrders)}
                  </td>
                  <td className="num text-muted">
                    {formatMoney({
                      amount: row.newCustomerRevenue,
                      currencyCode,
                    })}
                  </td>
                  <td className="num text-muted">
                    {formatNumber(row.repeatOrders)}
                  </td>
                  <td className="num text-muted">
                    {dashMoney(row.spend, currencyCode)}
                  </td>
                  <td
                    className={`num text-muted ${highlightEconomics ? "bg-accent-soft" : ""}`}
                  >
                    {dashRoas(row.roas)}
                  </td>
                  <td
                    className={`num text-muted ${highlightEconomics ? "bg-accent-soft" : ""}`}
                  >
                    {dashRoas(row.newCustomerRoas)}
                  </td>
                  <td className="num text-muted">
                    {dashMoney(row.cpa, currencyCode)}
                  </td>
                  <td className="num text-muted">
                    {dashMoney(row.ncCpa, currencyCode)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="text-foreground">Total</td>
                <td className="text-muted">—</td>
                <td className="num text-foreground">
                  {formatNumber(totals.orders)}
                </td>
                <td className="num text-foreground">
                  {formatMoney({ amount: totals.revenue, currencyCode })}
                </td>
                <td className="num text-foreground">
                  {formatNumber(totals.newCustomerOrders)}
                </td>
                <td className="num text-foreground">
                  {formatMoney({
                    amount: totals.newCustomerRevenue,
                    currencyCode,
                  })}
                </td>
                <td className="num text-foreground">
                  {formatNumber(totals.repeatOrders)}
                </td>
                <td className="num text-foreground">
                  {dashMoney(totals.spend, currencyCode)}
                </td>
                <td
                  className={`num text-foreground ${highlightEconomics ? "bg-accent-soft" : ""}`}
                >
                  {dashRoas(totals.roas)}
                </td>
                <td
                  className={`num text-foreground ${highlightEconomics ? "bg-accent-soft" : ""}`}
                >
                  {dashRoas(totals.newCustomerRoas)}
                </td>
                <td className="num text-foreground">
                  {dashMoney(totals.cpa, currencyCode)}
                </td>
                <td className="num text-foreground">
                  {dashMoney(totals.ncCpa, currencyCode)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </article>
  );
}
