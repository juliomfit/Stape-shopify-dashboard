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
