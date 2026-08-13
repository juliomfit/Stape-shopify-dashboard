"use server";

import { revalidatePath } from "next/cache";
import {
  clearMetaCredentials,
  getMetaCredentials,
  saveMetaCredentials,
} from "@/lib/ads/meta-credentials";
import { fetchMetaInsights } from "@/lib/ads/meta";
import { clearPendingOAuth, getPendingOAuth } from "@/lib/ads/meta-oauth";
import {
  clearMetaPaste,
  parseSpendPaste,
  saveMetaPaste,
} from "@/lib/ads/spend-paste";
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
  await clearPendingOAuth();
  refreshDashboard();
  return {
    ok: true,
    message: "Removed the saved Meta token from this machine.",
  };
}

export async function selectMetaAdAccount(adAccountId: string): Promise<MetaSyncState> {
  const pending = await getPendingOAuth();
  if (!pending) {
    return { ok: false, message: "Log in with Facebook again, then pick an ad account." };
  }

  const match = pending.accounts.find((account) => account.id === adAccountId);
  if (!match) {
    return { ok: false, message: "That ad account was not in the Facebook login list." };
  }

  await saveMetaCredentials({
    accessToken: pending.accessToken,
    adAccountId: match.id,
  });
  await clearPendingOAuth();
  refreshDashboard();
  return { ok: true, message: `Connected ${match.name}.` };
}

export async function saveMetaPasteAction(
  _prev: MetaSyncState,
  formData: FormData,
): Promise<MetaSyncState> {
  const paste = parseSpendPaste({
    spend: formData.get("spend"),
    purchases: formData.get("purchases"),
    revenue: formData.get("revenue"),
  });

  if (!paste) {
    return {
      ok: false,
      message: "Enter at least spend. Purchases and revenue are optional.",
    };
  }

  if (paste.spend !== null && paste.spend < 0) {
    return { ok: false, message: "Spend cannot be negative." };
  }

  const period = await getSelectedPeriod();
  await saveMetaPaste(period, paste);
  refreshDashboard();
  return {
    ok: true,
    message: `Saved Meta totals for ${period.label} (${period.startDate}–${period.endDate}).`,
  };
}

export async function clearMetaPasteAction(): Promise<MetaSyncState> {
  const period = await getSelectedPeriod();
  await clearMetaPaste(period);
  refreshDashboard();
  return {
    ok: true,
    message: `Cleared pasted Meta totals for ${period.label}.`,
  };
}
