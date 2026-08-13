import { BigQuery } from "@google-cloud/bigquery";
import { getBigQueryConfig, ignoreMissingCredentialFile } from "@/lib/stape/config";

let client: BigQuery | null = null;

export function getBigQueryClient() {
  ignoreMissingCredentialFile();
  const config = getBigQueryConfig();

  if (!config) {
    throw new Error("BigQuery is not configured.");
  }

  if (!config.credentials) {
    throw new Error(
      "BigQuery credentials are missing. On Vercel, set GOOGLE_SERVICE_ACCOUNT_JSON to the full service-account key as one line, and remove GOOGLE_APPLICATION_CREDENTIALS (that file path only exists on your laptop).",
    );
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
