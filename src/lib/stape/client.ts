import { BigQuery } from "@google-cloud/bigquery";
import { getBigQueryConfig, ignoreMissingCredentialFile } from "@/lib/stape/config";

ignoreMissingCredentialFile();

let client: BigQuery | null = null;

export function getBigQueryClient() {
  ignoreMissingCredentialFile();
  const config = getBigQueryConfig();

  if (!config) {
    throw new Error("BigQuery is not configured.");
  }

  if (!config.credentials) {
    throw new Error(
      "BigQuery credentials are missing. In Vercel: delete GOOGLE_APPLICATION_CREDENTIALS, then set GOOGLE_SERVICE_ACCOUNT_JSON to the full contents of secrets/gcp-service-account.json (the text that starts with {\"type\":\"service_account\"), and redeploy.",
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
