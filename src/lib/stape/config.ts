export type BigQueryConfig = {
  projectId: string;
  dataset: string;
  table: string;
  location: string;
  credentials?: object;
};

export function getBigQueryConfig(): BigQueryConfig | null {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const dataset = process.env.BIGQUERY_DATASET?.trim();
  const table = process.env.BIGQUERY_TABLE?.trim();

  if (!projectId || !dataset || !table) {
    return null;
  }

  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  let credentials: object | undefined;

  if (json) {
    try {
      credentials = JSON.parse(json) as object;
    } catch {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the full key as one line.",
      );
    }
  }

  return {
    projectId,
    dataset,
    table,
    location: process.env.BIGQUERY_LOCATION?.trim() || "US",
    credentials,
  };
}

export function isStapeConfigured() {
  try {
    return getBigQueryConfig() !== null;
  } catch {
    return true;
  }
}

export function tableId(config: BigQueryConfig) {
  return `\`${config.projectId}.${config.dataset}.${config.table}\``;
}
