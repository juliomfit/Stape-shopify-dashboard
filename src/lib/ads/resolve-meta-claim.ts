import type { PlatformClaim } from "@/lib/ads/types";

export type WarehouseMetaTotals = {
  spend: number;
  purchases: number;
  purchaseValue: number;
};

function empty(
  state: PlatformClaim["state"],
  message: string,
): PlatformClaim {
  return {
    source: "facebook",
    label: "Meta Ads",
    state,
    claimKind: "missing",
    message,
    spend: null,
    purchases: null,
    revenue: null,
  };
}

/**
 * Overview, First-touch, Warehouse, and Ask AI must resolve Meta spend
 * the same way as /meta. Warehouse rows win. Missing spend stays null.
 */
export function resolveMetaClaim(input: {
  warehouse: WarehouseMetaTotals | null;
  lastSuccessfulSync: boolean;
  periodDayCount: number;
  periodLabel: string;
  paste: PlatformClaim | null;
  flyweelConfigured: boolean;
  graph: PlatformClaim | null;
}): PlatformClaim {
  if (input.warehouse) {
    return {
      source: "facebook",
      label: "Meta Ads",
      state: "connected",
      claimKind: "warehouse",
      spend: input.warehouse.spend,
      purchases: input.warehouse.purchases,
      revenue: input.warehouse.purchaseValue,
      message: `Platform warehouse (Flyweel ingest) · ${input.periodLabel} · Ads Manager matching, not gn_*`,
    };
  }

  if (input.lastSuccessfulSync && input.periodDayCount <= 1) {
    return {
      source: "facebook",
      label: "Meta Ads",
      state: "connected",
      claimKind: "warehouse",
      spend: 0,
      purchases: 0,
      revenue: 0,
      message: `Platform warehouse · ${input.periodLabel} · $0 spend (Flyweel lag or no delivery). Not missing. Try Yesterday or 7d.`,
    };
  }

  if (input.paste && !input.flyweelConfigured) {
    return {
      ...input.paste,
      claimKind: input.paste.claimKind ?? "paste",
    };
  }

  if (input.flyweelConfigured) {
    return empty(
      "not_configured",
      `No warehouse Meta spend for ${input.periodLabel}. Press Refresh Meta on /meta. Missing spend is —.`,
    );
  }

  if (input.graph && input.graph.state === "connected") {
    return {
      ...input.graph,
      claimKind: input.graph.claimKind ?? "graph",
    };
  }

  return (
    input.graph ??
    empty(
      "not_configured",
      `Paste Ads Manager totals on First-touch or Refresh Meta for ${input.periodLabel}`,
    )
  );
}
