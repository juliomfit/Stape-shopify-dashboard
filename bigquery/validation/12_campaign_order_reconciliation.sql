-- 12 Campaign order reconciliation: OUR credited campaign vs Meta reported.

SELECT
  IFNULL(NULLIF(campaign, ""), "(unmapped)") AS campaign,
  COUNT(DISTINCT transaction_id) AS our_orders,
  SUM(attributed_revenue) AS our_revenue
FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
WHERE model_name = "last_non_direct"
  AND channel = "Facebook / Meta Ads"
GROUP BY 1
ORDER BY our_revenue DESC
LIMIT 50;

SELECT
  campaign_id,
  campaign_name,
  SUM(spend) AS spend,
  SUM(purchases) AS meta_purchases,
  SUM(purchase_value) AS meta_revenue
FROM `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`
WHERE date >= DATE_SUB(CURRENT_DATE("America/Los_Angeles"), INTERVAL 7 DAY)
GROUP BY 1, 2
ORDER BY spend DESC
LIMIT 50;

-- Join is name/UTM equality in the app. Unmapped OUR revenue must stay unmapped.
-- Do not proportionally allocate Meta spend onto unmapped orders.
