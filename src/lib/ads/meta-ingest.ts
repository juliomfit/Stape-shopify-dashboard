import { readDurableJson, writeDurableJson } from "@/lib/durable-json";
import { persistMetaWarehouse } from "@/lib/ads/meta-persist";
import { getMetaAdsProvider } from "@/lib/ads/providers";
import { flyweelApiKeyProblem, flyweelVerifiedChildGrain, shouldFetchDeepMetaInsights } from "@/lib/ads/providers/config";
import { FlyweelMetaAdsProvider, preferredFlyweelAccount } from "@/lib/ads/providers/flyweel";
import { resolveFlyweelAccountId, resolveFlyweelApiKey } from "@/lib/ads/providers/flyweel-credentials";
import type { MetaAccount, MetaAdsProvider, MetaInsightResult, MetaInsightRow } from "@/lib/ads/providers/types";
import { isPlatformBqReady } from "@/lib/platform/bq";
import { acquireSyncLock, releaseSyncLock } from "@/lib/platform/lock";
import { findActiveSyncRun, finishSyncRun, listSyncRuns, startSyncRun, type SyncRun } from "@/lib/platform/sync-runs";
import {
  META_SYNC_ALREADY_RUNNING,
  buildMetaSyncMetadata,
  isMetaSyncWinner,
  warehouseFinishErrorFromMetadata,
} from "@/lib/platform/sync-run-state";
import { countableGrainRows, type InsightGrainIdReport } from "@/lib/ads/insight-grain";
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
  if (provider.id === "flyweel") {
    const accountId = (configured || stored?.accountId || "209273195421975").replace(/^act_/, "");
    const account = {
      accountId,
      accountName: stored?.accountName || "GoodsNova Meta",
      platform: "meta" as const,
      provider: provider.id,
    };
    await writeDurableJson("flyweel-account", {
      accountId,
      accountName: account.accountName,
      provider: provider.id,
    });
    return account;
  }
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

  const resolvedProvider = provider;
  const already = await findActiveSyncRun("meta");
  if (already) {
    return { ok: false, message: META_SYNC_ALREADY_RUNNING, run: already };
  }

  const run = await startSyncRun({
    source: "meta",
    syncType: input.syncType || "insights",
    lookbackStart: input.startDate,
    lookbackEnd: input.endDate,
    metadata: { provider: provider.id },
  });
  const peers = await listSyncRuns("meta");
  if (!isMetaSyncWinner([run, ...peers], run.id)) {
    await finishSyncRun(run, {
      status: "failed",
      error_message: META_SYNC_ALREADY_RUNNING,
    });
    return { ok: false, message: META_SYNC_ALREADY_RUNNING, run };
  }
  const locked = await acquireSyncLock("meta", run.id);
  if (!locked) {
    await finishSyncRun(run, {
      status: "failed",
      error_message: META_SYNC_ALREADY_RUNNING,
    });
    return { ok: false, message: META_SYNC_ALREADY_RUNNING, run };
  }

  let inserted = 0;
  let failed = 0;
  let requests = 0;
  let campaignRowCount = 0;
  let adsetRowCount = 0;
  let adRowCount = 0;
  let campaignGrain: InsightGrainIdReport = {
    raw_rows: 0,
    valid_campaign_id_rows: 0,
    valid_adset_id_rows: 0,
    valid_ad_id_rows: 0,
  };
  let adsetGrain: InsightGrainIdReport = {
    raw_rows: 0,
    valid_campaign_id_rows: 0,
    valid_adset_id_rows: 0,
    valid_ad_id_rows: 0,
  };
  let adGrain: InsightGrainIdReport = {
    raw_rows: 0,
    valid_campaign_id_rows: 0,
    valid_adset_id_rows: 0,
    valid_ad_id_rows: 0,
  };
  let adsetSkip: string | undefined;
  let adSkip: string | undefined;
  let accountId = "";
  const steps: string[] = [];
  const now = new Date().toISOString();
  const deepIngest = shouldFetchDeepMetaInsights(provider.id);

  function observabilityMetadata(extra?: Record<string, unknown>) {
    const elapsedMs = Math.max(0, Date.now() - (Date.parse(run.started_at) || Date.now()));
    const payload = {
      ...buildMetaSyncMetadata({
        provider: resolvedProvider.id,
        deep_ingest_enabled: deepIngest,
        campaign_row_count: campaignRowCount,
        adset_row_count: adsetRowCount,
        ad_row_count: adRowCount,
        provider_requests: requests,
        elapsed_ms: elapsedMs,
        adset_skip: adsetSkip,
        ad_skip: adSkip,
        steps,
        account_id: accountId || undefined,
        campaign_raw_rows: campaignGrain.raw_rows,
        campaign_valid_campaign_id_rows: campaignGrain.valid_campaign_id_rows,
        campaign_valid_adset_id_rows: campaignGrain.valid_adset_id_rows,
        campaign_valid_ad_id_rows: campaignGrain.valid_ad_id_rows,
        adset_raw_rows: adsetGrain.raw_rows,
        adset_valid_campaign_id_rows: adsetGrain.valid_campaign_id_rows,
        adset_valid_adset_id_rows: adsetGrain.valid_adset_id_rows,
        adset_valid_ad_id_rows: adsetGrain.valid_ad_id_rows,
        ad_raw_rows: adGrain.raw_rows,
        ad_valid_campaign_id_rows: adGrain.valid_campaign_id_rows,
        ad_valid_adset_id_rows: adGrain.valid_adset_id_rows,
        ad_valid_ad_id_rows: adGrain.valid_ad_id_rows,
        child_grain_verified: flyweelVerifiedChildGrain(),
      }),
      ...extra,
    };
    console.info("[meta-sync]", JSON.stringify(payload));
    return JSON.stringify(payload);
  }

  try {
    const keyProblem = provider.id === "flyweel" ? flyweelApiKeyProblem(await resolveFlyweelApiKey()) : null;
    if (keyProblem) {
      throw new Error(keyProblem);
    }
    const account = await resolveAccount(provider);
    accountId = account.accountId.replace(/^act_/, "");
    steps.push(`provider:${provider.id}`, `account:${accountId}`);

    if (provider instanceof FlyweelMetaAdsProvider && process.env.FLYWEEL_SELECT_ON_REFRESH === "1") {
      try {
        await provider.selectConfiguredMetaAccounts(accountId);
        steps.push("flyweel-select-meta");
      } catch (error) {
        steps.push(`flyweel-select-skip:${error instanceof Error ? error.message : "error"}`);
      }
    }

    if (provider instanceof FlyweelMetaAdsProvider && provider.sync) {
      const sync = await provider.sync({ startDate: input.startDate, endDate: input.endDate });
      requests += sync.requests;
      steps.push(sync.ok ? "flyweel-refresh" : "flyweel-refresh-skipped");
    }

    const chunkSize = 93;
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
      const campaignAccepted = countableGrainRows("campaign", campaign.rows);
      campaignGrain = {
        raw_rows: campaignGrain.raw_rows + campaignAccepted.report.raw_rows,
        valid_campaign_id_rows:
          campaignGrain.valid_campaign_id_rows + campaignAccepted.report.valid_campaign_id_rows,
        valid_adset_id_rows:
          campaignGrain.valid_adset_id_rows + campaignAccepted.report.valid_adset_id_rows,
        valid_ad_id_rows: campaignGrain.valid_ad_id_rows + campaignAccepted.report.valid_ad_id_rows,
      };
      campaign.rows = campaignAccepted.rows;
      campaignRowCount += campaignAccepted.count;
      let adset: MetaInsightResult = { rows: [], actions: [], requests: 0, splits: 0, truncated: false };
      let ad: MetaInsightResult = { rows: [], actions: [], requests: 0, splits: 0, truncated: false };
      const deep = shouldFetchDeepMetaInsights(provider.id);
      if (deep) {
        try {
          adset = await provider.getInsights({
            accountId,
            startDate: window.startDate,
            endDate: window.endDate,
            level: "adset",
          });
          requests += adset.requests;
          const adsetAccepted = countableGrainRows("adset", adset.rows);
          adsetGrain = {
            raw_rows: adsetGrain.raw_rows + adsetAccepted.report.raw_rows,
            valid_campaign_id_rows:
              adsetGrain.valid_campaign_id_rows + adsetAccepted.report.valid_campaign_id_rows,
            valid_adset_id_rows:
              adsetGrain.valid_adset_id_rows + adsetAccepted.report.valid_adset_id_rows,
            valid_ad_id_rows: adsetGrain.valid_ad_id_rows + adsetAccepted.report.valid_ad_id_rows,
          };
          adset.rows = adsetAccepted.rows;
          adsetRowCount += adsetAccepted.count;
          if (adsetAccepted.skip) {
            adsetSkip = adsetAccepted.skip;
            steps.push(`adset-skip:${adsetSkip}`);
          }
        } catch (error) {
          adsetSkip = error instanceof Error ? error.message : "error";
          steps.push(`adset-skip:${adsetSkip}`);
        }
        try {
          ad = await provider.getInsights({
            accountId,
            startDate: window.startDate,
            endDate: window.endDate,
            level: "ad",
          });
          requests += ad.requests;
          const adAccepted = countableGrainRows("ad", ad.rows);
          adGrain = {
            raw_rows: adGrain.raw_rows + adAccepted.report.raw_rows,
            valid_campaign_id_rows:
              adGrain.valid_campaign_id_rows + adAccepted.report.valid_campaign_id_rows,
            valid_adset_id_rows: adGrain.valid_adset_id_rows + adAccepted.report.valid_adset_id_rows,
            valid_ad_id_rows: adGrain.valid_ad_id_rows + adAccepted.report.valid_ad_id_rows,
          };
          ad.rows = adAccepted.rows;
          adRowCount += adAccepted.count;
          if (adAccepted.skip) {
            adSkip = adAccepted.skip;
            steps.push(`ad-skip:${adSkip}`);
          }
        } catch (error) {
          adSkip = error instanceof Error ? error.message : "error";
          steps.push(`ad-skip:${adSkip}`);
        }
      } else {
        steps.push("flyweel-campaign-only");
      }
      if (provider.id === "flyweel" && campaign.rows.length === 0) {
        const flyweel = provider instanceof FlyweelMetaAdsProvider ? provider : null;
        const querySnippet = flyweel?.lastDebug() || "";
        let setupMessage = "";
        try {
          if (flyweel) {
            const setup = await flyweel.setupSummary();
            if (setup.metaConnected && setup.metaSelected === 0) {
              throw new Error(setup.message);
            }
            setupMessage = setup.message;
          }
        } catch (error) {
          if (error instanceof Error && /no ad account is selected/i.test(error.message)) {
            throw error;
          }
          setupMessage = error instanceof Error ? error.message : setupMessage;
        }
        throw new Error(
          [
            setupMessage,
            "Flyweel returned 0 campaign rows after parsing.",
            "Stay on /meta and press Refresh Meta once. This does not pause ads.",
            querySnippet ? `Last metrics payload: ${querySnippet.slice(0, 700)}` : "",
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
      metadata: observabilityMetadata(),
    });
    const warehouseFinishError = warehouseFinishErrorFromMetadata(finished.metadata);
    return {
      ok: true,
      message: warehouseFinishError
        ? `Meta ${input.startDate}–${input.endDate} via ${provider.label}: ${inserted} rows, ${requests} provider requests. ${warehouseFinishError}`
        : `Meta ${input.startDate}–${input.endDate} via ${provider.label}: ${inserted} rows, ${requests} provider requests.`,
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
      metadata: observabilityMetadata(snippet ? { flyweel: snippet } : undefined),
    });
    return { ok: false, message, run: finished };
  } finally {
    await releaseSyncLock("meta");
  }
}

export async function syncMetaIncremental() {
  const window = lookbackWindow(2);
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
