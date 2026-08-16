-- Channel rules v1. Click IDs outrank UTMs outrank referrer.
-- Do not copy CASE statements into dashboard queries; join or reuse this view.

CREATE OR REPLACE TABLE `stape-analytics-487802.analytics.dim_channel_rules` (
  rule_version STRING,
  precedence INT64,
  match_type STRING,
  match_value STRING,
  channel STRING,
  channel_group STRING,
  is_paid BOOL,
  is_direct BOOL
);

INSERT INTO `stape-analytics-487802.analytics.dim_channel_rules` (
  rule_version, precedence, match_type, match_value, channel, channel_group, is_paid, is_direct
) VALUES
  ("v1", 10, "click_id", "gclid", "Google Ads", "Paid Search", TRUE, FALSE),
  ("v1", 11, "click_id", "gbraid", "Google Ads", "Paid Search", TRUE, FALSE),
  ("v1", 12, "click_id", "wbraid", "Google Ads", "Paid Search", TRUE, FALSE),
  ("v1", 13, "click_id", "dclid", "Google Ads", "Paid Search", TRUE, FALSE),
  ("v1", 20, "click_id", "fbclid", "Facebook / Meta Ads", "Paid Social", TRUE, FALSE),
  ("v1", 30, "click_id", "msclkid", "Microsoft Ads", "Paid Search", TRUE, FALSE),
  ("v1", 40, "click_id", "ttclid", "TikTok Ads", "Paid Social", TRUE, FALSE);

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.v_channel_classified` AS
SELECT
  e.*,
  CASE
    WHEN e.gclid IS NOT NULL OR e.gbraid IS NOT NULL OR e.wbraid IS NOT NULL OR e.dclid IS NOT NULL
      THEN "Google Ads"
    WHEN e.fbclid IS NOT NULL THEN "Facebook / Meta Ads"
    WHEN e.msclkid IS NOT NULL THEN "Microsoft Ads"
    WHEN e.ttclid IS NOT NULL THEN "TikTok Ads"
    WHEN LOWER(IFNULL(e.utm_source, "")) IN ("google")
      AND LOWER(IFNULL(e.utm_medium, "")) IN ("cpc", "ppc", "paid", "paidsearch", "paid_search")
      THEN "Google Ads"
    WHEN LOWER(IFNULL(e.utm_source, "")) IN ("facebook", "fb", "ig", "instagram", "meta")
      AND LOWER(IFNULL(e.utm_medium, "")) IN ("cpc", "ppc", "paid", "paidsocial", "paid_social", "paid-social")
      THEN "Facebook / Meta Ads"
    WHEN LOWER(IFNULL(e.utm_source, "")) IN ("tiktok") THEN "TikTok Ads"
    WHEN LOWER(IFNULL(e.utm_source, "")) IN ("bing", "microsoft") THEN "Microsoft Ads"
    WHEN LOWER(IFNULL(e.utm_medium, "")) IN ("email", "sms", "edm", "newsletter", "mms")
      OR LOWER(IFNULL(e.utm_source, "")) IN ("klaviyo", "omnisend", "email", "sms", "judgeme", "postscript", "attentive", "sendvio", "mailchimp", "brevo", "privy", "yotpo", "smsbump", "listrak", "drip")
      THEN "Email"
    WHEN LOWER(IFNULL(e.utm_source, "")) IN ("facebook", "fb", "ig", "instagram", "meta")
      OR REGEXP_CONTAINS(LOWER(IFNULL(e.referrer_host, "")), r"facebook|instagram|l.facebook")
      THEN "Meta Organic"
    WHEN LOWER(IFNULL(e.utm_source, "")) IN ("google", "youtube")
      OR REGEXP_CONTAINS(LOWER(IFNULL(e.referrer_host, "")), r"(^|\.)google\.|(^|\.)youtube\.")
      THEN "Google Organic"
    WHEN IFNULL(e.page_location, "") LIKE "%web-pixels@%"
      OR IFNULL(e.page_path, "") LIKE "/checkouts/%"
      THEN "Direct"
    WHEN e.utm_source IS NULL
      AND e.gclid IS NULL AND e.fbclid IS NULL
      AND (
        e.page_referrer IS NULL
        OR e.page_referrer = ""
        OR e.referrer_host = e.page_host
      )
      THEN "Direct"
    ELSE "Other"
  END AS channel
FROM `stape-analytics-487802.analytics.stg_events` AS e;

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.v_channel_classified_enriched` AS
SELECT
  c.*,
  CASE
    WHEN c.channel IN ("Google Ads", "Facebook / Meta Ads", "TikTok Ads", "Microsoft Ads")
      THEN "Paid"
    WHEN c.channel IN ("Google Organic", "Meta Organic") THEN "Organic"
    WHEN c.channel = "Email" THEN "CRM"
    WHEN c.channel = "Direct" THEN "Direct"
    ELSE "Other"
  END AS channel_group,
  c.channel IN ("Google Ads", "Facebook / Meta Ads", "TikTok Ads", "Microsoft Ads") AS is_paid,
  c.channel = "Direct" AS is_direct
FROM `stape-analytics-487802.analytics.v_channel_classified` AS c;
