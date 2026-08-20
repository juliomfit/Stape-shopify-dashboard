import { cache } from "react";
import { cachedLoad, periodCacheKey } from "@/lib/cache/server-data";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { getGoogleClaimed } from "@/lib/ads/google";
import { getMetaClaimed } from "@/lib/ads/meta";
import type { PlatformClaim, PlatformReported } from "@/lib/ads/types";
import type { DashboardPeriod } from "@/lib/period";
import { readDurableJson } from "@/lib/durable-json";

type FileClaim = {
  spend?: number;
  purchases?: number;
  revenue?: number;
};

async function readFileClaims() {
  return readDurableJson<{
    facebook?: FileClaim;
    google?: FileClaim;
  }>("platform-reported");
}

function mergeClaim(
  live: PlatformClaim,
  file: FileClaim | undefined,
): PlatformClaim {
  if (live.state === "connected") {
    return live;
  }

  if (
    !file ||
    (file.spend == null && file.purchases == null && file.revenue == null)
  ) {
    return live;
  }

  return {
    ...live,
    state: "connected",
    claimKind: "file",
    spend: file.spend ?? null,
    purchases: file.purchases ?? null,
    revenue: file.revenue ?? null,
    message: "From secrets/platform-reported.json (copied from Ads Manager)",
  };
}

export const getPlatformReported = cache(
  async (period: DashboardPeriod): Promise<PlatformReported> => {
    return cachedLoad({
      key: ["platform-reported", ...periodCacheKey(period)],
      tags: [CACHE_TAGS.meta, CACHE_TAGS.dashboardCore, CACHE_TAGS.paste],
      loader: "platform_reported",
      period: `${period.startDate}..${period.endDate}`,
      fn: () => loadPlatformReported(period),
    });
  },
);

async function loadPlatformReported(
  period: DashboardPeriod,
): Promise<PlatformReported> {
  const [facebook, google, file] = await Promise.all([
    getMetaClaimed(period),
    getGoogleClaimed(period),
    readFileClaims(),
  ]);
  const googleMerged = mergeClaim(google, file?.google);
  const meta = mergeClaim(facebook, file?.facebook);
  const spendParts = [meta.spend, googleMerged.spend].filter(
    (value): value is number => value !== null,
  );

  return {
    facebook: meta,
    google: googleMerged,
    totalSpend: spendParts.length > 0 ? spendParts.reduce((a, b) => a + b, 0) : null,
  };
}
