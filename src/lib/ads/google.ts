import { getGooglePaste, pasteToClaim } from "@/lib/ads/spend-paste";
import type { PlatformClaim } from "@/lib/ads/types";
import type { DashboardPeriod } from "@/lib/period";

function readNumber(name: string) {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return null;
  }

  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : null;
}

export async function getGoogleClaimed(
  period: DashboardPeriod,
): Promise<PlatformClaim> {
  const pasted = await getGooglePaste(period);
  if (pasted) {
    return pasteToClaim(
      pasted,
      `Pasted from Google Ads · ${period.label} (${period.startDate}–${period.endDate})`,
      "google",
    );
  }

  const spend = readNumber("GOOGLE_ADS_SPEND");
  const purchases = readNumber("GOOGLE_ADS_PURCHASES");
  const revenue = readNumber("GOOGLE_ADS_REVENUE");

  if (spend === null && purchases === null && revenue === null) {
    return {
      source: "google",
      label: "Google Ads",
      state: "not_configured",
      claimKind: "missing",
      message:
        "Paste Google Ads spend on First-touch for this date range",
      spend: null,
      purchases: null,
      revenue: null,
    };
  }

  return {
    source: "google",
    label: "Google Ads",
    state: "connected",
    claimKind: "env",
    spend,
    purchases,
    revenue,
    message:
      "GOOGLE_ADS_* in .env.local applies to every date range — paste on the page instead when you switch ranges",
  };
}
