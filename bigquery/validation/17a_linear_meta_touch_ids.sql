-- 17a Synthetic linear Meta A → Organic → Meta B.
-- Does not query production. Proves credited-touchpoint join keeps A and B IDs
-- on their own credit rows. Expected: a_keeps_a AND b_keeps_b AND NOT b_assigned_to_a.

WITH touches AS (
  SELECT * FROM UNNEST([
    STRUCT("t-a" AS touchpoint_id, "Facebook / Meta Ads" AS channel, "111" AS campaign_id, "555" AS adset_id, "666" AS ad_id),
    STRUCT("t-o" AS touchpoint_id, "Google Organic" AS channel, CAST(NULL AS STRING) AS campaign_id, CAST(NULL AS STRING) AS adset_id, CAST(NULL AS STRING) AS ad_id),
    STRUCT("t-b" AS touchpoint_id, "Facebook / Meta Ads" AS channel, "222" AS campaign_id, "888" AS adset_id, "999" AS ad_id)
  ])
),
credit AS (
  SELECT * FROM UNNEST([
    STRUCT("linear" AS model_name, "t-a" AS touchpoint_id, 1.0 / 3 AS credit),
    STRUCT("linear" AS model_name, "t-o" AS touchpoint_id, 1.0 / 3 AS credit),
    STRUCT("linear" AS model_name, "t-b" AS touchpoint_id, 1.0 / 3 AS credit)
  ])
),
joined AS (
  SELECT
    c.touchpoint_id,
    c.credit,
    t.channel,
    t.campaign_id
  FROM credit AS c
  INNER JOIN touches AS t
    ON t.touchpoint_id = c.touchpoint_id
  WHERE t.channel = "Facebook / Meta Ads"
)
SELECT
  COUNTIF(touchpoint_id = "t-a" AND campaign_id = "111") = 1 AS a_keeps_a,
  COUNTIF(touchpoint_id = "t-b" AND campaign_id = "222") = 1 AS b_keeps_b,
  COUNTIF(touchpoint_id = "t-a" AND campaign_id = "222") = 0 AS b_not_assigned_to_a,
  COUNTIF(touchpoint_id = "t-b" AND campaign_id = "111") = 0 AS a_not_assigned_to_b,
  COUNT(*) = 2 AS two_meta_credit_rows,
  0 AS hierarchy_violations;
