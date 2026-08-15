import type { PlatformClaim, PlatformReported } from "@/lib/ads/types";

export function claimKindLabel(claim: PlatformClaim): string {
  switch (claim.claimKind) {
    case "warehouse":
      return "platform warehouse";
    case "paste":
      return "Ads Manager paste";
    case "graph":
      return "Meta Graph (live)";
    case "env":
      return "env paste";
    case "file":
      return "saved file paste";
    case "missing":
      return "missing";
    default:
      return claim.state === "connected" ? "connected" : "missing";
  }
}

export function metaSpendSourceLine(claim: PlatformClaim, periodLabel: string): string {
  if (claim.spend === null) {
    return claim.message || `Meta spend missing · ${periodLabel} · shown as —`;
  }
  return `${claim.message || `Meta ${claimKindLabel(claim)}`} · ${periodLabel}`;
}

export function blendedAdSpendSource(ads: PlatformReported, periodLabel: string): string {
  if (ads.totalSpend === null) {
    return `No ad spend for ${periodLabel} · Meta warehouse or Google paste missing · shown as —`;
  }
  const meta =
    ads.facebook.spend === null
      ? "Meta —"
      : `Meta ${claimKindLabel(ads.facebook)}`;
  const google =
    ads.google.spend === null
      ? "Google —"
      : `Google ${claimKindLabel(ads.google)}`;
  return `${meta} + ${google} · ${periodLabel} · not gn_* first-touch`;
}

export function firstTouchSourceLine(periodLabel: string): string {
  return `Shopify gn_* first-touch · ${periodLabel} · not Ads Manager`;
}

export function stapeSessionSourceLine(periodLabel: string): string {
  return `Stape sessions · ${periodLabel} · same definition as Overview funnel`;
}
