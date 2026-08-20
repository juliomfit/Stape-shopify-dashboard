"use server";

import { revalidatePath } from "next/cache";
import { invalidateCachedSources, updateCachedMutation } from "@/lib/cache/invalidate";
import { runScheduledSync, syncMetaBackfill } from "@/lib/platform/orchestrator";
import { addChangeLog } from "@/lib/platform/change-log";
import { saveBusinessContext } from "@/lib/platform/business-context";
import { saveCogsDay } from "@/lib/platform/cogs-store";
import { parseYmd } from "@/lib/period";
import { selectMetaAdAccount } from "@/lib/ads/meta-actions";
import { saveFlyweelCredentials } from "@/lib/ads/providers/flyweel-credentials";

function refresh() {
  revalidatePath("/", "layout");
}

export async function refreshSourceAction(source: string) {
  const result = await runScheduledSync(source, { invalidation: "hard" });
  refresh();
  return result;
}

export async function backfillMetaAction(startDate: string, endDate: string) {
  if (!parseYmd(startDate) || !parseYmd(endDate) || startDate > endDate) {
    return { ok: false, message: "Use YYYY-MM-DD with start ≤ end." };
  }
  const result = await syncMetaBackfill(startDate, endDate);
  if (result.ok) {
    await invalidateCachedSources("meta", { mode: "hard" });
  }
  refresh();
  return result;
}

export async function saveFlyweelKeyForm(formData: FormData) {
  const apiKey = String(formData.get("apiKey") || "");
  const accountId = String(formData.get("accountId") || "209273195421975");
  await saveFlyweelCredentials({ apiKey, accountId });
  updateCachedMutation("credentials");
  refresh();
}

export async function pickMetaAdAccountAction(formData: FormData) {
  const id = String(formData.get("adAccountId") || "");
  await selectMetaAdAccount(id);
}

export async function addChangeLogForm(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  if (!title) {
    return;
  }
  await addChangeLog({
    type: String(formData.get("type") || "note"),
    title,
    description: String(formData.get("description") || ""),
    entityType: String(formData.get("entityType") || "account"),
    entityId: String(formData.get("entityId") || ""),
  });
  refresh();
}

export async function saveCogsDayForm(formData: FormData) {
  const result = await saveCogsDay({
    date: String(formData.get("date") || ""),
    amount: String(formData.get("amount") || ""),
    note: String(formData.get("note") || ""),
  });
  if (result.ok) {
    updateCachedMutation("cogs");
    refresh();
  }
  return result;
}

export async function saveBusinessContextForm(formData: FormData) {
  const numberOrNull = (name: string) => {
    const raw = String(formData.get(name) || "").trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  await saveBusinessContext({
    business: String(formData.get("business") || "GoodsNova"),
    primaryProduct: String(formData.get("primaryProduct") || "InstaFrame"),
    targetCpa: numberOrNull("targetCpa"),
    targetMer: numberOrNull("targetMer"),
    targetContributionMargin: numberOrNull("targetContributionMargin"),
    typicalCogs: numberOrNull("typicalCogs"),
    shippingCostAssumption: numberOrNull("shippingCostAssumption"),
    paidChannels: String(formData.get("paidChannels") || ""),
    primaryConversion: String(formData.get("primaryConversion") || "Shopify purchase"),
    currency: String(formData.get("currency") || "USD"),
  });
  refresh();
}
