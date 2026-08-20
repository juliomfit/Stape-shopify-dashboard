import { getBigQueryClient } from "@/lib/stape/client";
import { getBigQueryConfig } from "@/lib/stape/config";
import { platformDataset, platformTable } from "@/lib/platform/config";

export function isPlatformBqReady() {
  try {
    return getBigQueryConfig() !== null;
  } catch {
    return false;
  }
}

export async function runPlatformQuery<T extends Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  const { client } = getBigQueryClient();
  const [job] = await client.createQueryJob({
    query: sql,
    params,
    location: getBigQueryConfig()?.location || "US",
  });
  const [rows] = await job.getQueryResults();
  return rows as T[];
}

export async function platformWarehouseStatus(): Promise<{
  ready: boolean;
  projectId: string;
  dataset: string;
  serviceAccount: string;
  message: string;
}> {
  const config = getBigQueryConfig();
  const dataset = platformDataset();
  const serviceAccount =
    config?.credentials &&
    typeof config.credentials === "object" &&
    "client_email" in config.credentials
      ? String((config.credentials as { client_email?: string }).client_email || "")
      : "";
  if (!config) {
    return {
      ready: false,
      projectId: "",
      dataset,
      serviceAccount,
      message: "BigQuery is not configured.",
    };
  }
  try {
    const { client } = getBigQueryClient();
    const [exists] = await client
      .dataset(dataset, { projectId: config.projectId })
      .exists();
    if (!exists) {
      return {
        ready: false,
        projectId: config.projectId,
        dataset,
        serviceAccount,
        message: `Dataset ${config.projectId}.${dataset} does not exist. The dashboard service account cannot create it.`,
      };
    }
    return {
      ready: true,
      projectId: config.projectId,
      dataset,
      serviceAccount,
      message: "Platform warehouse is ready.",
    };
  } catch (error) {
    return {
      ready: false,
      projectId: config.projectId,
      dataset,
      serviceAccount,
      message: error instanceof Error ? error.message : "Platform warehouse check failed.",
    };
  }
}

export async function ensurePlatformTables() {
  const status = await platformWarehouseStatus();
  const table = platformTable("sync_runs");
  if (!table || !status.ready) {
    return;
  }
  await runPlatformQuery(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id STRING NOT NULL,
      source STRING NOT NULL,
      sync_type STRING NOT NULL,
      started_at TIMESTAMP NOT NULL,
      completed_at TIMESTAMP,
      status STRING NOT NULL,
      records_requested INT64,
      records_inserted INT64,
      records_updated INT64,
      records_failed INT64,
      lookback_start DATE,
      lookback_end DATE,
      error_message STRING,
      metadata STRING
    )
  `);
  const campaigns = platformTable("meta_campaign_insights_daily");
  if (campaigns) {
    await runPlatformQuery(`
      CREATE TABLE IF NOT EXISTS ${campaigns} (
        date DATE NOT NULL,
        account_id STRING NOT NULL,
        campaign_id STRING NOT NULL,
        campaign_name STRING,
        spend FLOAT64,
        impressions INT64,
        reach INT64,
        frequency FLOAT64,
        clicks INT64,
        inline_link_clicks INT64,
        unique_clicks INT64,
        cpc FLOAT64,
        cpm FLOAT64,
        ctr FLOAT64,
        purchases FLOAT64,
        purchase_value FLOAT64,
        add_to_cart FLOAT64,
        initiate_checkout FLOAT64,
        landing_page_views FLOAT64,
        actions_json STRING,
        action_values_json STRING,
        provider STRING,
        synced_at TIMESTAMP,
        sync_run_id STRING
      )
      PARTITION BY date
      CLUSTER BY account_id, campaign_id
    `);
  }
  const cogs = platformTable("raw_cogs_daily");
  if (cogs) {
    await runPlatformQuery(`
      CREATE TABLE IF NOT EXISTS ${cogs} (
        date DATE NOT NULL,
        amount FLOAT64 NOT NULL,
        note STRING,
        updated_at TIMESTAMP NOT NULL
      )
    `);
  }
}

function isStreamingBufferError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /streaming buffer/i.test(message);
}

async function deleteIfPossible(sql: string, params?: Record<string, unknown>) {
  try {
    await runPlatformQuery(sql, params);
  } catch (error) {
    if (isStreamingBufferError(error)) {
      return;
    }
    throw error;
  }
}

export async function replaceDateWindow(input: {
  table: string;
  accountId: string;
  startDate: string;
  endDate: string;
  extraWhere?: string;
  rows: Record<string, unknown>[];
}) {
  const fq = platformTable(input.table);
  if (!fq) {
    throw new Error("BigQuery is not configured.");
  }
  await deleteIfPossible(
    `DELETE FROM ${fq}
     WHERE account_id = @accountId
       AND date BETWEEN @startDate AND @endDate
       ${input.extraWhere || ""}`,
    {
      accountId: input.accountId,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  );
  if (input.rows.length === 0) {
    return;
  }

  const { client, config } = getBigQueryClient();
  const dataset = client.dataset(platformDataset(), { projectId: config.projectId });
  const table = dataset.table(input.table);
  const chunkSize = 400;
  for (let i = 0; i < input.rows.length; i += chunkSize) {
    const chunk = input.rows.slice(i, i + chunkSize);
    await table.insert(chunk, { ignoreUnknownValues: true, raw: false });
  }
}

export async function replaceAccountEntities(input: {
  table: string;
  accountId: string;
  rows: Record<string, unknown>[];
}) {
  const fq = platformTable(input.table);
  if (!fq) {
    throw new Error("BigQuery is not configured.");
  }
  await deleteIfPossible(`DELETE FROM ${fq} WHERE account_id = @accountId`, {
    accountId: input.accountId,
  });
  if (input.rows.length === 0) {
    return;
  }
  const { client, config } = getBigQueryClient();
  const table = client
    .dataset(platformDataset(), { projectId: config.projectId })
    .table(input.table);
  const chunkSize = 400;
  for (let i = 0; i < input.rows.length; i += chunkSize) {
    await table.insert(input.rows.slice(i, i + chunkSize), {
      ignoreUnknownValues: true,
    });
  }
}

export async function insertRows(tableName: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return;
  }
  const { client, config } = getBigQueryClient();
  const table = client
    .dataset(platformDataset(), { projectId: config.projectId })
    .table(tableName);
  const chunkSize = 400;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await table.insert(rows.slice(i, i + chunkSize), { ignoreUnknownValues: true });
  }
}

/**
 * Canonicalize one id to one row. DELETE may no-op while the streaming
 * buffer is hot; then INSERT a terminal row and listSyncRuns collapses
 * running+completed duplicates on read. Do not rewrite unrelated history.
 */
export async function replaceRowsById(tableName: string, rows: Record<string, unknown>[]) {
  const fq = platformTable(tableName);
  if (!fq) {
    throw new Error("BigQuery is not configured.");
  }
  for (const row of rows) {
    const id = String(row.id || "");
    if (!id) continue;
    await deleteIfPossible(`DELETE FROM ${fq} WHERE id = @id`, { id });
  }
  await insertRows(tableName, rows);
}
