import { readFile } from "fs/promises";
import path from "path";
import { getGoogleClaimed } from "@/lib/ads/google";
import { getMetaClaimed } from "@/lib/ads/meta";
import type { PlatformClaim, PlatformReported } from "@/lib/ads/types";
import type { DashboardPeriod } from "@/lib/period";

type FileClaim = {
  spend?: number;
  purchases?: number;
  revenue?: number;
};

async function readFileClaims() {
  try {
    const file = await readFile(
      path.join(process.cwd(), "secrets/platform-reported.json"),
      "utf8",
    );
    return JSON.parse(file) as {
      facebook?: FileClaim;
      google?: FileClaim;
    };
  } catch {
    return null;
  }
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
    spend: file.spend ?? null,
    purchases: file.purchases ?? null,
    revenue: file.revenue ?? null,
    message: "From secrets/platform-reported.json (copied from Ads Manager)",
  };
}

export async function getPlatformReported(
  period: DashboardPeriod,
): Promise<PlatformReported> {
  const [facebook, file] = await Promise.all([
    getMetaClaimed(period),
    readFileClaims(),
  ]);
  const google = mergeClaim(getGoogleClaimed(), file?.google);
  const meta = mergeClaim(facebook, file?.facebook);
  const spendParts = [meta.spend, google.spend].filter(
    (value): value is number => value !== null,
  );

  return {
    facebook: meta,
    google,
    totalSpend: spendParts.length > 0 ? spendParts.reduce((a, b) => a + b, 0) : null,
  };
}
