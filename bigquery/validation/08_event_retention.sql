-- 08 Event retention / lifecycle.

SELECT
  table_name,
  option_name,
  option_value
FROM `stape-analytics-487802.stape_data.INFORMATION_SCHEMA.TABLE_OPTIONS`
WHERE table_name IN ("raw_events_full", "dashboard_events")
  AND option_name IN ("expiration_timestamp", "partition_expiration_days", "friendly_name");

SELECT
  MIN(DATE(TIMESTAMP_MILLIS(timestamp), "America/Los_Angeles")) AS min_event_date,
  MAX(DATE(TIMESTAMP_MILLIS(timestamp), "America/Los_Angeles")) AS max_event_date,
  DATE_DIFF(
    MAX(DATE(TIMESTAMP_MILLIS(timestamp), "America/Los_Angeles")),
    MIN(DATE(TIMESTAMP_MILLIS(timestamp), "America/Los_Angeles")),
    DAY
  ) AS retained_days
FROM `stape-analytics-487802.stape_data.raw_events_full`;

-- If retained_days < 60, do not expose a 60-day attribution window as complete.
-- If dashboard_events still has expiration_timestamp ~ 2026-10-11, run migration 003.
