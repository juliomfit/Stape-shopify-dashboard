import { cache } from "react";
import { getGa4Config } from "@/lib/ads/ga4-config";
import { googleAdsApiConfigured, googleAdsEnvTotalsConfigured } from "@/lib/platform/google-health";
import { latestSuccessfulSync, latestSync } from "@/lib/platform/sync-runs";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { isStapeConfigured } from "@/lib/stape/config";
import {
  buildFreshnessSnapshot,
  buildSourceFreshness,
  type FreshnessSnapshot,
} from "@/lib/freshness/model";

export const getFreshnessSnapshot = cache(async (): Promise<FreshnessSnapshot> => {
  const [
    metaLatest,
    metaOk,
    shopifyLatest,
    shopifyOk,
    ga4Latest,
    ga4Ok,
    stapeLatest,
    stapeOk,
    googleLatest,
    googleOk,
  ] = await Promise.all([
    latestSync("meta"),
    latestSuccessfulSync("meta"),
    latestSync("shopify"),
    latestSuccessfulSync("shopify"),
    latestSync("ga4"),
    latestSuccessfulSync("ga4"),
    latestSync("stape"),
    latestSuccessfulSync("stape"),
    latestSync("google_ads"),
    latestSuccessfulSync("google_ads"),
  ]);

  const googleConfigured = googleAdsApiConfigured() || googleAdsEnvTotalsConfigured();
  const sources = [
    buildSourceFreshness({
      source: "shopify",
      configured: isShopifyConfigured(),
      latest: shopifyLatest,
      lastSuccess: shopifyOk,
    }),
    buildSourceFreshness({
      source: "meta",
      configured: Boolean(process.env.FLYWEEL_API_KEY?.trim()),
      latest: metaLatest,
      lastSuccess: metaOk,
    }),
    buildSourceFreshness({
      source: "ga4",
      configured: Boolean(getGa4Config()),
      latest: ga4Latest,
      lastSuccess: ga4Ok,
    }),
    buildSourceFreshness({
      source: "stape",
      configured: isStapeConfigured(),
      latest: stapeLatest,
      lastSuccess: stapeOk,
    }),
  ];
  if (googleConfigured) {
    sources.push(
      buildSourceFreshness({
        source: "google_ads",
        configured: true,
        latest: googleLatest,
        lastSuccess: googleOk,
      }),
    );
  }
  return buildFreshnessSnapshot(sources);
});
