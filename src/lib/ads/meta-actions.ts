"use server";

import { revalidatePath } from "next/cache";
import {
  clearMetaCredentials,
  getMetaCredentials,
  saveMetaCredentials,
} from "@/lib/ads/meta-credentials";
import { fetchMetaInsights } from "@/lib/ads/meta";
import { getSelectedPeriod } from "@/lib/period-server";

export type MetaSyncState = {
  ok: boolean;
  message: string;
};

function refreshDashboard() {
  revalidatePath("/attribution");
  revalidatePath("/");
}

export async function saveAndSyncMeta(
  _prev: MetaSyncState,
  formData: FormData,
): Promise<MetaSyncState> {
  const accessToken = String(formData.get("accessToken") || "").trim();
  const adAccountId = String(formData.get("adAccountId") || "")
    .trim()
    .replace(/^act_/, "");

  if (!accessToken || !adAccountId) {
    return {
      ok: false,
      message: "Paste both the ad account ID and the access token.",
    };
  }

  if (!/^\d+$/.test(adAccountId)) {
    return {
      ok: false,
      message: "Ad account ID should be numbers only (you can leave off act_).",
    };
  }

  try {
    const period = await getSelectedPeriod();
    const claim = await fetchMetaInsights(period, accessToken, adAccountId);
    await saveMetaCredentials({ accessToken, adAccountId });
    refreshDashboard();
    return {
      ok: true,
      message: `Synced ${period.label}: spend ${claim.spend ?? 0}, purchases ${claim.purchases ?? 0}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Meta rejected the token or ad account.",
    };
  }
}

export async function syncMetaSpend(): Promise<MetaSyncState> {
  const { credentials } = await getMetaCredentials();
  if (!credentials) {
    return {
      ok: false,
      message: "Save a Meta token first, then press Sync.",
    };
  }

  try {
    const period = await getSelectedPeriod();
    const claim = await fetchMetaInsights(
      period,
      credentials.accessToken,
      credentials.adAccountId,
    );
    refreshDashboard();
    return {
      ok: true,
      message: `Synced ${period.label}: spend ${claim.spend ?? 0}, purchases ${claim.purchases ?? 0}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Meta sync failed.",
    };
  }
}

export async function disconnectMeta(): Promise<MetaSyncState> {
  await clearMetaCredentials();
  refreshDashboard();
  return {
    ok: true,
    message: "Removed the saved Meta token from this machine.",
  };
}
