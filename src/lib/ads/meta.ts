import type { DashboardPeriod } from "@/lib/period";
import type { PlatformClaim } from "@/lib/ads/types";

function empty(state: PlatformClaim["state"], message?: string): PlatformClaim {
  return {
    source: "facebook",
    label: "Meta Ads",
    state,
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

export async function getMetaClaimed(
  period: DashboardPeriod,
): Promise<PlatformClaim> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const account = process.env.META_AD_ACCOUNT_ID?.trim();

  if (!token || !account) {
    return empty(
      "not_configured",
      "Add META_ACCESS_TOKEN and META_AD_ACCOUNT_ID to .env.local",
    );
  }

  const actId = account.startsWith("act_") ? account : `act_${account}`;
  const url = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  url.searchParams.set("fields", "spend,actions,action_values");
  url.searchParams.set(
    "time_range",
    JSON.stringify({ since: period.startDate, until: period.endDate }),
  );
  url.searchParams.set("level", "account");
  url.searchParams.set("access_token", token);

  try {
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
      return empty(
        "error",
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
      spend: Number(row.spend || 0),
      purchases: actionNumber(row.actions, purchaseTypes),
      revenue: actionNumber(row.action_values, purchaseTypes),
    };
  } catch (error) {
    return empty(
      "error",
      error instanceof Error ? error.message : "Meta API request failed",
    );
  }
}
