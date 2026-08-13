-- Run as BigQuery Editor. The dashboard service account cannot create datasets.
CREATE SCHEMA IF NOT EXISTS `stape-analytics-487802.analytics`
OPTIONS (
  location = "US",
  description = "GoodsNova first-party attribution warehouse. Raw GTM tables stay in stape_data."
);
