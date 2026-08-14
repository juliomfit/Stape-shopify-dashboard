import { readFileSync } from "fs";
import { existsSync } from "fs";

export type BigQueryConfig = {
  projectId: string;
  dataset: string;
  table: string;
  location: string;
  credentials?: object;
};

function parseServiceAccountJson(json: string) {
  const credentials = JSON.parse(json) as { private_key?: string };
  if (typeof credentials.private_key === "string") {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }
  return credentials;
}

function looksLikeServiceAccountJson(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("{") && trimmed.includes("private_key");
}

function looksLikeAccidentalCommand(value: string) {
  const trimmed = value.trim();
  if (looksLikeServiceAccountJson(trimmed)) {
    return false;
  }
  return (
    /^jq\b/.test(trimmed) ||
    trimmed.includes("pbcopy") ||
    trimmed.includes("|") ||
    trimmed.startsWith("cat ")
  );
}

/**
 * @google-cloud/bigquery always reads GOOGLE_APPLICATION_CREDENTIALS when
 * that env var is set. On Vercel that must never be a laptop path or a
 * pasted shell command — only GOOGLE_SERVICE_ACCOUNT_JSON is valid.
 */
export function ignoreMissingCredentialFile() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!raw) {
    return;
  }

  const value = raw.trim();
  const onServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );

  if (looksLikeServiceAccountJson(value) && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = value;
  }

  if (
    onServerless ||
    looksLikeServiceAccountJson(value) ||
    looksLikeAccidentalCommand(value) ||
    !existsSync(value)
  ) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
}

function loadServiceAccount(): object | undefined {
  ignoreMissingCredentialFile();

  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    if (looksLikeAccidentalCommand(json) || !json.startsWith("{")) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_JSON must be the key file contents, starting with {"type":"service_account". Do not paste a terminal command. In Vercel, delete GOOGLE_APPLICATION_CREDENTIALS, paste the JSON file into GOOGLE_SERVICE_ACCOUNT_JSON, and redeploy.',
      );
    }
    try {
      return parseServiceAccountJson(json);
    } catch {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Open secrets/gcp-service-account.json, copy the whole file, paste it into that Vercel env var, delete GOOGLE_APPLICATION_CREDENTIALS, and redeploy.",
      );
    }
  }

  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (filePath && existsSync(filePath)) {
    return parseServiceAccountJson(readFileSync(filePath, "utf8"));
  }

  return undefined;
}

export function getBigQueryConfig(): BigQueryConfig | null {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const dataset = process.env.BIGQUERY_DATASET?.trim();
  const table = process.env.BIGQUERY_TABLE?.trim();

  if (!projectId || !dataset || !table) {
    return null;
  }

  return {
    projectId,
    dataset,
    table,
    location: process.env.BIGQUERY_LOCATION?.trim() || "US",
    credentials: loadServiceAccount(),
  };
}

export function isStapeConfigured() {
  try {
    return getBigQueryConfig() !== null;
  } catch {
    return false;
  }
}

export function tableId(config: BigQueryConfig) {
  return `\`${config.projectId}.${config.dataset}.${config.table}\``;
}

/**
 * Queryable events subquery. Live pipeline: stape_data.dashboard_events
 * (view over raw_events_full, event_date in America/Los_Angeles).
 * Data Client rows whose event_name already exists in GA4 are dropped by
 * the view; leftover shopify_order hits have no transaction_id and must
 * not be counted as sessions.
 */
export function eventsFromSql(config: BigQueryConfig) {
  const table = tableId(config);

  if (config.table === "dashboard_events") {
    return `(
      SELECT
        UNIX_MILLIS(event_time) AS timestamp,
        event_name,
        event_id,
        client_id,
        user_id,
        ga_session_id,
        page_location,
        page_referrer,
        gclid,
        gbraid,
        wbraid,
        dclid,
        CAST(NULL AS STRING) AS fbclid,
        CAST(NULL AS STRING) AS fbc,
        CAST(NULL AS STRING) AS fbp,
        CAST(NULL AS STRING) AS ttclid,
        CAST(NULL AS STRING) AS msclkid,
        transaction_id,
        value,
        currency
      FROM ${table}
      WHERE IFNULL(source_client, 'GA4') = 'GA4'
        AND LOWER(IFNULL(event_name, '')) != 'shopify_order'
    )`;
  }

  if (config.table === "raw_events_full") {
    return `(
      SELECT
        timestamp,
        event_name,
        event_id,
        client_id,
        user_id,
        ga_session_id,
        page_location,
        page_referrer,
        gclid,
        gbraid,
        wbraid,
        dclid,
        CAST(NULL AS STRING) AS fbclid,
        CAST(NULL AS STRING) AS fbc,
        CAST(NULL AS STRING) AS fbp,
        CAST(NULL AS STRING) AS ttclid,
        CAST(NULL AS STRING) AS msclkid,
        transaction_id,
        value,
        currency
      FROM ${table}
      WHERE IFNULL(source_client, 'GA4') = 'GA4'
        AND event_name IS NOT NULL
        AND LOWER(IFNULL(event_name, '')) != 'shopify_order'
    )`;
  }

  return table;
}

/** Maps browser client_id → Shopify customer user_id using Data Client purchase events. */
export function identityMapSql(config: BigQueryConfig) {
  const full = `\`${config.projectId}.stape_data.raw_events_full\``;

  return `(
    SELECT client_id, ANY_VALUE(user_id) AS user_id
    FROM (
      SELECT client_id, user_id
      FROM ${full}
      WHERE IFNULL(user_id, '') != ''
        AND IFNULL(client_id, '') != ''
      UNION ALL
      SELECT g.client_id, u.user_id
      FROM (
        SELECT DISTINCT transaction_id, client_id
        FROM ${full}
        WHERE IFNULL(transaction_id, '') != ''
          AND IFNULL(client_id, '') != ''
      ) g
      JOIN (
        SELECT transaction_id, ANY_VALUE(user_id) AS user_id
        FROM ${full}
        WHERE IFNULL(user_id, '') != ''
          AND IFNULL(transaction_id, '') != ''
        GROUP BY transaction_id
      ) u
      USING (transaction_id)
    )
    GROUP BY client_id
  )`;
}
