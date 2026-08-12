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

/**
 * Queryable events subquery. The live Stape pipeline writes to
 * stape_data.raw_events_full / dashboard_events (includes purchase +
 * begin_checkout). stape_shopify_dashboard.stape_events is a newer
 * test table and does not have those events yet.
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
        ga_session_id,
        page_location,
        page_referrer,
        gclid,
        CAST(NULL AS STRING) AS fbclid,
        CAST(NULL AS STRING) AS fbc,
        CAST(NULL AS STRING) AS fbp,
        transaction_id,
        value,
        currency
      FROM ${table}
    )`;
  }

  if (config.table === "raw_events_full") {
    return `(
      SELECT
        timestamp,
        event_name,
        event_id,
        client_id,
        ga_session_id,
        page_location,
        page_referrer,
        gclid,
        CAST(NULL AS STRING) AS fbclid,
        CAST(NULL AS STRING) AS fbc,
        CAST(NULL AS STRING) AS fbp,
        transaction_id,
        value,
        currency
      FROM ${table}
      WHERE IFNULL(source_client, 'GA4') = 'GA4'
        AND event_name IS NOT NULL
    )`;
  }

  return table;
}
