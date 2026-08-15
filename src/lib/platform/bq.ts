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

export async function ensurePlatformTables() {
  const table = platformTable("sync_runs");
  if (!table) {
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
  if (input.rows.length === 0) {
    await runPlatformQuery(
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
    return;
  }

  const { client, config } = getBigQueryClient();
  const dataset = client.dataset(platformDataset(), { projectId: config.projectId });
  const table = dataset.table(input.table);
  await runPlatformQuery(
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
  await runPlatformQuery(`DELETE FROM ${fq} WHERE account_id = @accountId`, {
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
