-- 05 Meta campaign mapping coverage.
-- Purchase-event URLs are usually checkout pages, so utm_campaign on the
-- purchase row is expected to be 0. Measure campaign on credited touches
-- (from v_attribution_credit_v1) and fbclid on both purchase rows and path.
--
-- Observed 2026-08-01 → 2026-08-19 (purchase-event grain, first run):
--   purchase_orders=72, purchase_event_with_fbclid=39, purchase_event_utm_campaign=0,
--   meta_campaign_rows=1
-- Re-run this file after the dim_person credit view so touch-grain columns fill.

DECLARE start_ms INT64 DEFAULT UNIX_MILLIS(TIMESTAMP("2026-08-01", "America/Los_Angeles"));
DECLARE end_ms INT64 DEFAULT UNIX_MILLIS(TIMESTAMP("2026-08-19", "America/Los_Angeles"));

WITH purchases AS (
  SELECT
    transaction_id,
    LOGICAL_OR(IFNULL(fbclid, "") != "" OR IFNULL(page_location, "") LIKE "%fbclid=%") AS purchase_event_has_fbclid,
    LOGICAL_OR(REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_campaign=")) AS purchase_event_has_utm_campaign
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= start_ms AND timestamp < end_ms
    AND LOWER(IFNULL(event_name, "")) = "purchase"
    AND IFNULL(transaction_id, "") != ""
  GROUP BY transaction_id
),
touches AS (
  SELECT
    transaction_id,
    LOGICAL_OR(IFNULL(campaign, "") != "") AS has_campaign_on_touch,
    LOGICAL_OR(channel = "Facebook / Meta Ads") AS has_meta_paid_touch
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  WHERE model_name = "linear"
    AND transaction_id IN (SELECT transaction_id FROM purchases)
  GROUP BY transaction_id
),
meta_campaigns AS (
  SELECT DISTINCT campaign_id, campaign_name
  FROM `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`
  WHERE date >= DATE("2026-08-01")
    AND date < DATE("2026-08-19")
)
SELECT
  (SELECT COUNT(*) FROM purchases) AS purchase_orders,
  (SELECT COUNTIF(purchase_event_has_fbclid) FROM purchases) AS purchase_event_with_fbclid,
  (SELECT COUNTIF(purchase_event_has_utm_campaign) FROM purchases) AS purchase_event_with_utm_campaign,
  (SELECT COUNT(*) FROM touches) AS orders_with_credited_journey,
  (SELECT COUNTIF(has_campaign_on_touch) FROM touches) AS orders_with_campaign_on_touch,
  (SELECT COUNTIF(has_meta_paid_touch) FROM touches) AS orders_with_meta_paid_touch,
  (SELECT COUNT(*) FROM meta_campaigns) AS meta_campaign_rows_in_range,
  SAFE_DIVIDE(
    (SELECT COUNTIF(purchase_event_has_fbclid) FROM purchases),
    (SELECT COUNT(*) FROM purchases)
  ) AS purchase_event_fbclid_rate,
  SAFE_DIVIDE(
    (SELECT COUNTIF(has_campaign_on_touch) FROM touches),
    (SELECT COUNT(*) FROM purchases)
  ) AS touch_campaign_rate,
  SAFE_DIVIDE(
    (SELECT COUNTIF(has_meta_paid_touch) FROM touches),
    (SELECT COUNT(*) FROM purchases)
  ) AS meta_paid_touch_rate;

-- App campaign OUR-revenue join is name/UTM equality in
-- src/lib/attribution/campaign-map.ts. Do not smear Meta spend onto unmapped orders.
-- Do not put purchase_event_utm_campaign=0 in the UI as "no campaign tracking".
