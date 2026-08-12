import { BigQuery } from "@google-cloud/bigquery";
import { getBigQueryConfig } from "@/lib/stape/config";

let client: BigQuery | null = null;

export function getBigQueryClient() {
  const config = getBigQueryConfig();

  if (!config) {
    throw new Error("BigQuery is not configured.");
  }

  if (!client) {
    client = new BigQuery({
      projectId: config.projectId,
      credentials: config.credentials,
      location: config.location,
    });
  }

  return { client, config };
}
