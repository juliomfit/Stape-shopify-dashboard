-- Configurable lookbacks and time-decay half-life. Not view-through.

CREATE OR REPLACE TABLE `stape-analytics-487802.analytics.dim_attribution_settings` (
  setting_key STRING,
  setting_value STRING,
  value_type STRING,
  description STRING
);

INSERT INTO `stape-analytics-487802.analytics.dim_attribution_settings` VALUES
  ("default_lookback_days", "30", "int", "Default click/session lookback"),
  ("lookback_days_options", "1,7,14,28,30,60,90", "int_list", "Allowed windows"),
  ("time_decay_half_life_hours", "168", "float", "Half-life for time-decay model (7 days)"),
  ("position_first_weight", "0.4", "float", "Position-based first touch"),
  ("position_last_weight", "0.4", "float", "Position-based last touch"),
  ("position_middle_weight", "0.2", "float", "Position-based middle remainder"),
  ("logic_version", "v1", "string", "Channel + attribution logic version"),
  ("view_through", "false", "bool", "Warehouse has click/session data only");
