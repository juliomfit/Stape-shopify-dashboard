import { readDurableJson, writeDurableJson } from "@/lib/durable-json";
import { persistMetaWarehouse } from "@/lib/ads/meta-persist";
import { getMetaAdsProvider } from "@/lib/ads/providers";
import { flyweelApiKeyProblem } from "@/lib/ads/providers/config";
import { FlyweelMetaAdsProvider, preferredFlyweelAccount } from "@/lib/ads/providers/flyweel";
import { resolveFlyweelAccountId, resolveFlyweelApiKey } from "@/lib/ads/providers/flyweel-credentials";
import type { MetaAccount, MetaAdsProvider, MetaInsightResult, MetaInsightRow } from "@/lib/ads/providers/types";
import { isPlatformBqReady } from "@/lib/platform/bq";
import { acquireSyncLock, releaseSyncLock } from "@/lib/platform/lock";
import { finishSyncRun, startSyncRun, type SyncRun } from "@/lib/platform/sync-runs";
import { getDashboardPeriod, pacificDaysInRange } from "@/lib/period";
import { addDaysYmd } from "@/lib/ads/providers/chunk";

export type MetaSyncResult = {
  ok: boolean;
  message: string;
  run: SyncRun | null;
};

type AccountStore = { accountId: string; accountName: string; provider: string };

function lookbackWindow(days: number) {
  const today = getDashboardPeriod("today").startDate;
  return {
    startDate: addDaysYmd(today, -(days - 1)),
    endDate: today,
  };
}

function dateWindows(startDate: string, endDate: string, size: number) {
  const days = pacificDaysInRange(startDate, endDate);
  const windows: { startDate: string; endDate: string }[] = [];
  for (let i = 0; i < days.length; i += size) {
    windows.push({
      startDate: days[i],
      endDate: days[Math.min(i + size - 1, days.length - 1)],
    });
  }
  return windows;
}

async function resolveAccount(provider: MetaAdsProvider): Promise<MetaAccount> {
  const stored = await readDurableJson<AccountStore>("flyweel-account");
  const configured = await resolveFlyweelAccountId();
  let accounts: MetaAccount[] = [];
  try {
    accounts = await provider.getAccounts();
  } catch {
    accounts = [];
  }
  const match =
    accounts.find((row) => row.accountId.replace(/^act_/, "") === configured) ||
    accounts.find((row) => stored && row.accountId.replace(/^act_/, "") === stored.accountId) ||
    preferredFlyweelAccount(accounts) ||
    (configured
      ? {
          accountId: configured,
          accountName: stored?.accountName || "GoodsNova Meta",
          platform: "meta" as const,
          provider: provider.id,
        }
      : null);
  if (!match) {
    throw new Error(
      "No Meta ad account. Set FLYWEEL_META_ACCOUNT_ID to the Ads Manager act= number (209273195421975).",
    );
  }
  await writeDurableJson("flyweel-account", {
    accountId: match.accountId.replace(/^act_/, ""),
    accountName: match.accountName,
    provider: provider.id,
  });
  return match;
}

function entitiesFromInsights(account: MetaAccount, rows: MetaInsightRow[]) {
  const campaigns = new Map<string, { campaignId: string; campaignName: string }>();
  const adsets = new Map<string, { campaignId?: string; adsetId: string; adsetName: string }>();
  const ads = new Map<string, { campaignId?: string; adsetId?: string; adId: string; adName: string }>();
  for (const row of rows) {
    if (row.campaignId) {
      campaigns.set(row.campaignId, {
        campaignId: row.campaignId,
        campaignName: row.campaignName || row.campaignId,
      });
    }
    if (row.adsetId) {
      adsets.set(row.adsetId, {
        campaignId: row.campaignId,
        adsetId: row.adsetId,
        adsetName: row.adsetName || row.adsetId,
      });
    }
    if (row.adId) {
      ads.set(row.adId, {
        campaignId: row.campaignId,
        adsetId: row.adsetId,
        adId: row.adId,
        adName: row.adName || row.adId,
      });
    }
  }
  return {
    campaigns: [...campaigns.values()].map((row) => ({ ...row, accountId: account.accountId })),
    adsets: [...adsets.values()].map((row) => ({ ...row, accountId: account.accountId })),
    ads: [...ads.values()].map((row) => ({ ...row, accountId: account.accountId })),
  };
}

export async function ingestMetaRange(input: {
  startDate: string;
  endDate: string;
  includeEntities?: boolean;
  syncType?: string;
}): Promise<MetaSyncResult> {
  const provider = await getMetaAdsProvider();
  if (!provider) {
    return {
      ok: false,
      message:
        "No Meta provider configured. Set FLYWEEL_API_KEY (production) or connect Meta Graph OAuth.",
      run: null,
    };
  }

  const run = await startSyncRun({
    source: "meta",
    syncType: input.syncType || "insights",
    lookbackStart: input.startDate,
    lookbackEnd: input.endDate,
    metadata: { provider: provider.id },
  });
  const locked = await acquireSyncLock("meta", run.id);
  if (!locked) {
    await finishSyncRun(run, {
      status: "failed",
      error_message: "Another Meta sync is already running.",
    });
    return { ok: false, message: "Another Meta sync is already running.", run };
  }

  let inserted = 0;
  let failed = 0;
  let requests = 0;
  const steps: string[] = [];
  const now = new Date().toISOString();

  try {
    const keyProblem = provider.id === "flyweel" ? flyweelApiKeyProblem(await resolveFlyweelApiKey()) : null;
    if (keyProblem) {
      throw new Error(keyProblem);
    }
    const account = await resolveAccount(provider);
    const accountId = account.accountId.replace(/^act_/, "");
    steps.push(`provider:${provider.id}`, `account:${accountId}`);

    if (provider.id === "flyweel" && process.env.FLYWEEL_TRIGGER_SYNC !== "0" && provider.sync) {
      const sync = await provider.sync({ startDate: input.startDate, endDate: input.endDate });
      requests += sync.requests;
      steps.push(sync.ok ? "flyweel-refresh" : "flyweel-refresh-skipped");
    }

    const chunkSize = provider.id === "flyweel" ? 7 : 93;
    const checkpoint = await readDurableJson<{
      rangeStart: string;
      rangeEnd: string;
      nextIndex: number;
    }>("meta-sync-checkpoint");
    const windows = dateWindows(input.startDate, input.endDate, chunkSize);
    let startIndex = 0;
    if (
      checkpoint &&
      checkpoint.rangeStart === input.startDate &&
      checkpoint.rangeEnd === input.endDate &&
      checkpoint.nextIndex > 0 &&
      checkpoint.nextIndex < windows.length
    ) {
      startIndex = checkpoint.nextIndex;
      steps.push(`resume:${startIndex}`);
    }

    const accCampaigns = new Map<string, ReturnType<typeof entitiesFromInsights>["campaigns"][number]>();
    const accAdsets = new Map<string, ReturnType<typeof entitiesFromInsights>["adsets"][number]>();
    const accAds = new Map<string, ReturnType<typeof entitiesFromInsights>["ads"][number]>();
    let graphCreatives: Awaited<ReturnType<MetaAdsProvider["getCreatives"]>> = [];

    for (let i = startIndex; i < windows.length; i += 1) {
      const window = windows[i];
      await writeDurableJson("meta-sync-checkpoint", {
        rangeStart: input.startDate,
        rangeEnd: input.endDate,
        nextIndex: i,
        window,
      });
      const campaign = await provider.getInsights({
        accountId,
        startDate: window.startDate,
        endDate: window.endDate,
        level: "campaign",
      });
      requests += campaign.requests;
      let adset: MetaInsightResult = { rows: [], actions: [], requests: 0, splits: 0, truncated: false };
      let ad: MetaInsightResult = { rows: [], actions: [], requests: 0, splits: 0, truncated: false };
      const deep = provider.id !== "flyweel" || process.env.FLYWEEL_INGEST_LEVELS === "all";
      if (deep) {
        try {
          adset = await provider.getInsights({
            accountId,
            startDate: window.startDate,
            endDate: window.endDate,
            level: "adset",
          });
          requests += adset.requests;
        } catch (error) {
          steps.push(`adset-skip:${error instanceof Error ? error.message : "error"}`);
        }
        try {
          ad = await provider.getInsights({
            accountId,
            startDate: window.startDate,
            endDate: window.endDate,
            level: "ad",
          });
          requests += ad.requests;
        } catch (error) {
          steps.push(`ad-skip:${error instanceof Error ? error.message : "error"}`);
        }
      } else {
        steps.push("flyweel-campaign-only");
      }
      if (provider.id === "flyweel" && campaign.rows.length === 0) {
        const flyweel = provider instanceof FlyweelMetaAdsProvider ? provider : null;
        let setup = "";
        try {
          setup = flyweel ? await flyweel.describeSetup() : "";
        } catch (error) {
          setup = error instanceof Error ? error.message : "";
        }
        const snippet = flyweel?.lastDebug() || "";
        throw new Error(
          [
            "Flyweel returned 0 campaign rows.",
            snippet ? `Last MCP payload: ${snippet}` : "",
            setup ? `Setup: ${setup}` : "",
            "If that payload is a table/JSON we missed, refresh again after this deploy.",
            "If it says Meta is disconnected: Flyweel Settings → Connections, connect Meta, select act=209273195421975, then Refresh Meta.",
          ]
            .filter(Boolean)
            .join(" "),
        );
      }

      const derived = entitiesFromInsights(account, [...campaign.rows, ...adset.rows, ...ad.rows]);
      for (const row of derived.campaigns) accCampaigns.set(row.campaignId, row);
      for (const row of derived.adsets) accAdsets.set(row.adsetId, row);
      for (const row of derived.ads) accAds.set(row.adId, row);

      if (input.includeEntities !== false && i === startIndex && provider.id === "meta_graph") {
        for (const row of await provider.getCampaigns(accountId)) accCampaigns.set(row.campaignId, row);
        for (const row of await provider.getAdSets(accountId)) accAdsets.set(row.adsetId, row);
        for (const row of await provider.getAds(accountId)) accAds.set(row.adId, row);
        graphCreatives = await provider.getCreatives(accountId);
        steps.push("graph-entities");
      }

      const last = i === windows.length - 1;
      const persisted = await persistMetaWarehouse({
        account,
        campaigns: last ? [...accCampaigns.values()] : undefined,
        adsets: last ? [...accAdsets.values()] : undefined,
        ads: last ? [...accAds.values()] : undefined,
        creatives: last ? graphCreatives : undefined,
        campaignInsights: campaign.rows,
        adsetInsights: adset.rows,
        adInsights: ad.rows,
        actions: [...campaign.actions, ...adset.actions, ...ad.actions],
        startDate: window.startDate,
        endDate: window.endDate,
        syncRunId: run.id,
        syncedAt: now,
      });
      inserted += persisted.inserted;
      steps.push(`${window.startDate}:${window.endDate}:${persisted.inserted}`);
      await writeDurableJson("meta-sync-checkpoint", {
        rangeStart: input.startDate,
        rangeEnd: input.endDate,
        nextIndex: i + 1,
      });
    }

    await writeDurableJson("meta-sync-checkpoint", {
      rangeStart: input.startDate,
      rangeEnd: input.endDate,
      nextIndex: windows.length,
      completedAt: now,
    });

    const finished = await finishSyncRun(run, {
      status: isPlatformBqReady() ? "completed" : "partial",
      records_requested: requests,
      records_inserted: inserted,
      records_failed: failed,
      error_message: isPlatformBqReady()
        ? null
        : "Insights cached locally. Run bigquery/platform/00_schema.sql to persist.",
      metadata: JSON.stringify({
        steps,
        provider: provider.id,
        provider_requests: requests,
        account_id: accountId,
      }),
    });
    return {
      ok: true,
      message: `Meta ${input.startDate}–${input.endDate} via ${provider.label}: ${inserted} rows, ${requests} provider requests.`,
      run: finished,
    };
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : "Meta sync failed";
    const snippet =
      provider instanceof FlyweelMetaAdsProvider ? provider.lastDebug() : "";
    const finished = await finishSyncRun(run, {
      status: inserted > 0 ? "partial" : "failed",
      records_inserted: inserted,
      records_failed: failed,
      records_requested: requests,
      error_message: message.slice(0, 2500),
      metadata: JSON.stringify({
        steps,
        provider: provider.id,
        provider_requests: requests,
        flyweel: snippet || undefined,
      }),
    });
    return { ok: false, message, run: finished };
  } finally {
    await releaseSyncLock("meta");
  }
}

export async function syncMetaIncremental() {
  const window = lookbackWindow(8);
  return ingestMetaRange({
    ...window,
    includeEntities: true,
    syncType: "incremental",
  });
}

export async function syncMetaBackfill(startDate: string, endDate: string) {
  const days = pacificDaysInRange(startDate, endDate);
  if (days.length === 0) {
    return { ok: false, message: "Invalid date range.", run: null };
  }
  if (days.length > 93) {
    return {
      ok: false,
      message: "Backfill is limited to 93 Pacific days per request.",
      run: null,
    };
  }
  return ingestMetaRange({
    startDate,
    endDate,
    includeEntities: true,
    syncType: "backfill",
  });
}

export async function backfillMeta(input: { startDate: string; endDate: string }) {
  return syncMetaBackfill(input.startDate, input.endDate);
}

export async function syncMeta() {
  return syncMetaIncremental();
}

export async function syncMetaHourly() {
  return syncMetaIncremental();
}
