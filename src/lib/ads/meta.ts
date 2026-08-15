import { getCampaignFacts, totalsFromFacts } from "@/lib/ads/meta-query";
import { getMetaCredentials } from "@/lib/ads/meta-credentials";
import { resolveFlyweelApiKey } from "@/lib/ads/providers/flyweel-credentials";
import { resolveMetaClaim } from "@/lib/ads/resolve-meta-claim";
import { getMetaPaste, pasteToClaim } from "@/lib/ads/spend-paste";
import type { PlatformClaim } from "@/lib/ads/types";
import type { DashboardPeriod } from "@/lib/period";
import { latestSuccessfulSync } from "@/lib/platform/sync-runs";

function readNumber(name: string) {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return null;
  }

  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : null;
}

function pastedMetaClaim(): PlatformClaim | null {
  const spend = readNumber("META_SPEND");
  const purchases = readNumber("META_PURCHASES");
  const revenue = readNumber("META_REVENUE");

  if (spend === null && purchases === null && revenue === null) {
    return null;
  }

  return {
    source: "facebook",
    label: "Meta Ads",
    state: "connected",
    claimKind: "env",
    spend,
    purchases,
    revenue,
    message: "Numbers you entered from Meta Ads Manager — not an API pull",
  };
}

function empty(state: PlatformClaim["state"], message?: string): PlatformClaim {
  return {
    source: "facebook",
    label: "Meta Ads",
    state,
    claimKind: state === "connected" ? "graph" : "missing",
    message,
    spend: null,
    purchases: null,
    revenue: null,
  };
}

function actionNumber(
  actions: { action_type?: string; value?: string }[] | undefined,
  types: string[],
) {
  for (const type of types) {
    const match = actions?.find((action) => action.action_type === type);
    if (match?.value) {
      const amount = Number(match.value);
      if (Number.isFinite(amount)) {
        return amount;
      }
    }
  }

  return 0;
}

export async function fetchMetaInsights(
  period: DashboardPeriod,
  accessToken: string,
  adAccountId: string,
): Promise<PlatformClaim> {
  const actId = adAccountId.startsWith("act_")
    ? adAccountId
    : `act_${adAccountId}`;
  const url = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  url.searchParams.set("fields", "spend,actions,action_values");
  url.searchParams.set(
    "time_range",
    JSON.stringify({ since: period.startDate, until: period.endDate }),
  );
  url.searchParams.set("level", "account");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as {
    data?: {
      spend?: string;
      actions?: { action_type?: string; value?: string }[];
      action_values?: { action_type?: string; value?: string }[];
    }[];
    error?: { message?: string };
  };

  if (!response.ok || payload.error) {
    throw new Error(
      payload.error?.message || `Meta API failed (${response.status})`,
    );
  }

  const row = payload.data?.[0];
  if (!row) {
    return {
      ...empty("connected"),
      spend: 0,
      purchases: 0,
      revenue: 0,
      message: `Synced ${period.label} · no Meta insights rows`,
    };
  }

  const purchaseTypes = [
    "purchase",
    "omni_purchase",
    "offsite_conversion.fb_pixel_purchase",
    "web_in_store_purchase",
  ];

  return {
    source: "facebook",
    label: "Meta Ads",
    state: "connected",
    claimKind: "graph",
    spend: Number(row.spend || 0),
    purchases: actionNumber(row.actions, purchaseTypes),
    revenue: actionNumber(row.action_values, purchaseTypes),
    message: `Synced from Meta API · ${period.label}`,
  };
}

async function pastedForPeriod(period: DashboardPeriod): Promise<PlatformClaim | null> {
  const filePaste = await getMetaPaste(period);
  if (filePaste) {
    return pasteToClaim(
      filePaste,
      `Pasted from Ads Manager · ${period.label} (${period.startDate}–${period.endDate})`,
    );
  }

  return pastedMetaClaim();
}

export async function getMetaClaimed(
  period: DashboardPeriod,
): Promise<PlatformClaim> {
  const [facts, lastSync, pasted, flyweelKey] = await Promise.all([
    getCampaignFacts(period),
    latestSuccessfulSync("meta"),
    pastedForPeriod(period),
    resolveFlyweelApiKey(),
  ]);
  const warehouse = facts.length
    ? (() => {
        const totals = totalsFromFacts(facts);
        return {
          spend: totals.spend,
          purchases: totals.purchases,
          purchaseValue: totals.purchaseValue,
        };
      })()
    : null;

  let graph: PlatformClaim | null = null;
  if (!warehouse && !lastSync && !pasted && !flyweelKey) {
    const { credentials } = await getMetaCredentials();
    if (!credentials) {
      graph = empty(
        "not_configured",
        "Paste Ads Manager totals on True Performance for this date range",
      );
    } else {
      try {
        graph = await fetchMetaInsights(
          period,
          credentials.accessToken,
          credentials.adAccountId,
        );
      } catch (error) {
        graph = empty(
          "error",
          error instanceof Error ? error.message : "Meta API request failed",
        );
      }
    }
  }

  return resolveMetaClaim({
    warehouse,
    lastSuccessfulSync: Boolean(lastSync),
    periodDayCount: period.dayCount,
    periodLabel: period.label,
    paste: pasted,
    flyweelConfigured: Boolean(flyweelKey),
    graph,
  });
}
