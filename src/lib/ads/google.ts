import type { PlatformClaim } from "@/lib/ads/types";

function readNumber(name: string) {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return null;
  }

  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : null;
}

export function getGoogleClaimed(): PlatformClaim {
  const spend = readNumber("GOOGLE_ADS_SPEND");
  const purchases = readNumber("GOOGLE_ADS_PURCHASES");
  const revenue = readNumber("GOOGLE_ADS_REVENUE");

  if (spend === null && purchases === null && revenue === null) {
    return {
      source: "google",
      label: "Google Ads",
      state: "not_configured",
      message:
        "Add GOOGLE_ADS_SPEND, GOOGLE_ADS_PURCHASES, and GOOGLE_ADS_REVENUE from Ads Manager for this date range",
      spend: null,
      purchases: null,
      revenue: null,
    };
  }

  return {
    source: "google",
    label: "Google Ads",
    state: "connected",
    spend,
    purchases,
    revenue,
    message: "Numbers you entered from Google Ads Manager — not an API pull",
  };
}
