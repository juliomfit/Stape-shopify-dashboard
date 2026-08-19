-- 04 Attribution model parity — SYNTHETIC golden journeys (no production PII).
-- Status: VALIDATION REQUIRED until Julio pastes the result (expect mismatch_count = 0).
-- Does not read customer data. Applies the same credit formulas as
-- bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql.
-- TypeScript twin: test/canonical-golden.test.ts
--
-- Fixtures (session-grain touches already collapsed):
-- A Meta → Google Organic → Real Direct
-- B Meta only (checkout noise already excluded)
-- C Direct only
-- D no touches
-- E Meta → Meta retargeting
-- F Meta → Organic → Email → Direct
-- G Organic → Email → Direct (paid_only empty)
-- I one Meta touch
-- J two touches Meta → Organic
-- K same-timestamp Meta + Email (touchpoint_id tie-break; only one touch gets 100%)
-- H duplicate session collapse is covered in TypeScript eligibility tests.

DECLARE purchase_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-18 12:00:00+00");

WITH journeys AS (
  SELECT * FROM UNNEST([
    STRUCT("A" AS fixture_id, "A-order" AS transaction_id, [
      STRUCT("s-meta" AS touchpoint_id, TIMESTAMP_SUB(purchase_ts, INTERVAL 240 HOUR) AS ts, "Facebook / Meta Ads" AS channel, TRUE AS is_paid, FALSE AS is_direct),
      STRUCT("s-org", TIMESTAMP_SUB(purchase_ts, INTERVAL 120 HOUR), "Google Organic", FALSE, FALSE),
      STRUCT("s-dir", TIMESTAMP_SUB(purchase_ts, INTERVAL 24 HOUR), "Direct", FALSE, TRUE)
    ] AS touches),
    STRUCT("B", "B-order", [
      STRUCT("s-meta", TIMESTAMP_SUB(purchase_ts, INTERVAL 48 HOUR), "Facebook / Meta Ads", TRUE, FALSE)
    ]),
    STRUCT("C", "C-order", [
      STRUCT("s-dir", TIMESTAMP_SUB(purchase_ts, INTERVAL 12 HOUR), "Direct", FALSE, TRUE)
    ]),
    STRUCT("E", "E-order", [
      STRUCT("s-meta-1", TIMESTAMP_SUB(purchase_ts, INTERVAL 120 HOUR), "Facebook / Meta Ads", TRUE, FALSE),
      STRUCT("s-meta-2", TIMESTAMP_SUB(purchase_ts, INTERVAL 24 HOUR), "Facebook / Meta Ads", TRUE, FALSE)
    ]),
    STRUCT("F", "F-order", [
      STRUCT("s-meta", TIMESTAMP_SUB(purchase_ts, INTERVAL 240 HOUR), "Facebook / Meta Ads", TRUE, FALSE),
      STRUCT("s-org", TIMESTAMP_SUB(purchase_ts, INTERVAL 120 HOUR), "Google Organic", FALSE, FALSE),
      STRUCT("s-email", TIMESTAMP_SUB(purchase_ts, INTERVAL 48 HOUR), "Email", FALSE, FALSE),
      STRUCT("s-dir", TIMESTAMP_SUB(purchase_ts, INTERVAL 24 HOUR), "Direct", FALSE, TRUE)
    ]),
    STRUCT("G", "G-order", [
      STRUCT("s-org", TIMESTAMP_SUB(purchase_ts, INTERVAL 72 HOUR), "Google Organic", FALSE, FALSE),
      STRUCT("s-email", TIMESTAMP_SUB(purchase_ts, INTERVAL 24 HOUR), "Email", FALSE, FALSE),
      STRUCT("s-dir", TIMESTAMP_SUB(purchase_ts, INTERVAL 2 HOUR), "Direct", FALSE, TRUE)
    ]),
    STRUCT("I", "I-order", [
      STRUCT("s-one", TIMESTAMP_SUB(purchase_ts, INTERVAL 10 HOUR), "Facebook / Meta Ads", TRUE, FALSE)
    ]),
    STRUCT("J", "J-order", [
      STRUCT("s-a", TIMESTAMP_SUB(purchase_ts, INTERVAL 48 HOUR), "Facebook / Meta Ads", TRUE, FALSE),
      STRUCT("s-b", TIMESTAMP_SUB(purchase_ts, INTERVAL 2 HOUR), "Google Organic", FALSE, FALSE)
    ]),
    STRUCT("K", "K-order", [
      STRUCT("s-a-meta", TIMESTAMP_SUB(purchase_ts, INTERVAL 24 HOUR), "Facebook / Meta Ads", TRUE, FALSE),
      STRUCT("s-b-email", TIMESTAMP_SUB(purchase_ts, INTERVAL 24 HOUR), "Email", FALSE, FALSE)
    ])
  ])
),
order_touches AS (
  SELECT
    j.fixture_id,
    j.transaction_id,
    t.touchpoint_id,
    t.ts AS touchpoint_timestamp,
    t.channel,
    t.is_paid,
    t.is_direct,
    TIMESTAMP_DIFF(purchase_ts, t.ts, HOUR) AS hours_to_conversion
  FROM journeys AS j
  CROSS JOIN UNNEST(j.touches) AS t
),
credited_raw AS (
  SELECT
    ot.*,
    model.model_name
  FROM order_touches AS ot
  CROSS JOIN UNNEST([
    STRUCT("first_touch" AS model_name),
    STRUCT("last_touch" AS model_name),
    STRUCT("last_non_direct" AS model_name),
    STRUCT("linear" AS model_name),
    STRUCT("position_based" AS model_name),
    STRUCT("paid_only" AS model_name),
    STRUCT("time_decay" AS model_name)
  ]) AS model
  QUALIFY CASE model.model_name
    WHEN "first_touch" THEN ROW_NUMBER() OVER (
      PARTITION BY ot.transaction_id, model.model_name
      ORDER BY ot.touchpoint_timestamp ASC, ot.touchpoint_id ASC
    ) = 1
    WHEN "last_touch" THEN ROW_NUMBER() OVER (
      PARTITION BY ot.transaction_id, model.model_name
      ORDER BY ot.touchpoint_timestamp DESC, ot.touchpoint_id DESC
    ) = 1
    WHEN "last_non_direct" THEN ROW_NUMBER() OVER (
      PARTITION BY ot.transaction_id, model.model_name
      ORDER BY IF(NOT ot.is_direct, 0, 1), ot.touchpoint_timestamp DESC, ot.touchpoint_id DESC
    ) = 1
    WHEN "paid_only" THEN ot.is_paid
    ELSE TRUE
  END
),
got AS (
  SELECT
    fixture_id,
    transaction_id,
    model_name,
    touchpoint_id,
    channel,
    CASE model_name
      WHEN "linear" THEN 1.0 / COUNT(*) OVER (PARTITION BY transaction_id, model_name)
      WHEN "paid_only" THEN 1.0 / COUNT(*) OVER (PARTITION BY transaction_id, model_name)
      WHEN "position_based" THEN
        CASE
          WHEN COUNT(*) OVER (PARTITION BY transaction_id, model_name) = 1 THEN 1.0
          WHEN COUNT(*) OVER (PARTITION BY transaction_id, model_name) = 2 THEN 0.5
          WHEN ROW_NUMBER() OVER (PARTITION BY transaction_id, model_name ORDER BY touchpoint_timestamp ASC, touchpoint_id) = 1 THEN 0.4
          WHEN ROW_NUMBER() OVER (PARTITION BY transaction_id, model_name ORDER BY touchpoint_timestamp DESC, touchpoint_id) = 1 THEN 0.4
          ELSE 0.2 / GREATEST(COUNT(*) OVER (PARTITION BY transaction_id, model_name) - 2, 1)
        END
      WHEN "time_decay" THEN
        POW(2, -IFNULL(hours_to_conversion, 0) / 168)
        / SUM(POW(2, -IFNULL(hours_to_conversion, 0) / 168)) OVER (PARTITION BY transaction_id, model_name)
      ELSE 1.0
    END AS credit
  FROM credited_raw
),
expected AS (
  SELECT * FROM UNNEST([
    STRUCT("A" AS fixture_id, "first_touch" AS model_name, "s-meta" AS touchpoint_id, 1.0 AS expected_credit),
    STRUCT("A", "last_touch", "s-dir", 1.0),
    STRUCT("A", "last_non_direct", "s-org", 1.0),
    STRUCT("A", "linear", "s-meta", 1.0/3),
    STRUCT("A", "linear", "s-org", 1.0/3),
    STRUCT("A", "linear", "s-dir", 1.0/3),
    STRUCT("A", "position_based", "s-meta", 0.4),
    STRUCT("A", "position_based", "s-org", 0.2),
    STRUCT("A", "position_based", "s-dir", 0.4),
    STRUCT("A", "paid_only", "s-meta", 1.0),
    STRUCT("A", "time_decay", "s-meta", POW(2, -240.0/168) / (POW(2, -240.0/168) + POW(2, -120.0/168) + POW(2, -24.0/168))),
    STRUCT("A", "time_decay", "s-org", POW(2, -120.0/168) / (POW(2, -240.0/168) + POW(2, -120.0/168) + POW(2, -24.0/168))),
    STRUCT("A", "time_decay", "s-dir", POW(2, -24.0/168) / (POW(2, -240.0/168) + POW(2, -120.0/168) + POW(2, -24.0/168))),
    STRUCT("B", "first_touch", "s-meta", 1.0),
    STRUCT("B", "last_touch", "s-meta", 1.0),
    STRUCT("B", "last_non_direct", "s-meta", 1.0),
    STRUCT("B", "linear", "s-meta", 1.0),
    STRUCT("B", "position_based", "s-meta", 1.0),
    STRUCT("B", "paid_only", "s-meta", 1.0),
    STRUCT("B", "time_decay", "s-meta", 1.0),
    STRUCT("C", "first_touch", "s-dir", 1.0),
    STRUCT("C", "last_touch", "s-dir", 1.0),
    STRUCT("C", "last_non_direct", "s-dir", 1.0),
    STRUCT("C", "linear", "s-dir", 1.0),
    STRUCT("C", "position_based", "s-dir", 1.0),
    STRUCT("C", "time_decay", "s-dir", 1.0),
    STRUCT("E", "linear", "s-meta-1", 0.5),
    STRUCT("E", "linear", "s-meta-2", 0.5),
    STRUCT("E", "position_based", "s-meta-1", 0.5),
    STRUCT("E", "position_based", "s-meta-2", 0.5),
    STRUCT("E", "first_touch", "s-meta-1", 1.0),
    STRUCT("E", "last_touch", "s-meta-2", 1.0),
    STRUCT("E", "last_non_direct", "s-meta-2", 1.0),
    STRUCT("E", "paid_only", "s-meta-1", 0.5),
    STRUCT("E", "paid_only", "s-meta-2", 0.5),
    STRUCT("E", "time_decay", "s-meta-1", POW(2, -120.0/168) / (POW(2, -120.0/168) + POW(2, -24.0/168))),
    STRUCT("E", "time_decay", "s-meta-2", POW(2, -24.0/168) / (POW(2, -120.0/168) + POW(2, -24.0/168))),
    STRUCT("F", "first_touch", "s-meta", 1.0),
    STRUCT("F", "last_touch", "s-dir", 1.0),
    STRUCT("F", "last_non_direct", "s-email", 1.0),
    STRUCT("F", "linear", "s-meta", 0.25),
    STRUCT("F", "linear", "s-org", 0.25),
    STRUCT("F", "linear", "s-email", 0.25),
    STRUCT("F", "linear", "s-dir", 0.25),
    STRUCT("F", "position_based", "s-meta", 0.4),
    STRUCT("F", "position_based", "s-org", 0.1),
    STRUCT("F", "position_based", "s-email", 0.1),
    STRUCT("F", "position_based", "s-dir", 0.4),
    STRUCT("F", "paid_only", "s-meta", 1.0),
    STRUCT("F", "time_decay", "s-meta", POW(2, -240.0/168) / (POW(2, -240.0/168) + POW(2, -120.0/168) + POW(2, -48.0/168) + POW(2, -24.0/168))),
    STRUCT("F", "time_decay", "s-org", POW(2, -120.0/168) / (POW(2, -240.0/168) + POW(2, -120.0/168) + POW(2, -48.0/168) + POW(2, -24.0/168))),
    STRUCT("F", "time_decay", "s-email", POW(2, -48.0/168) / (POW(2, -240.0/168) + POW(2, -120.0/168) + POW(2, -48.0/168) + POW(2, -24.0/168))),
    STRUCT("F", "time_decay", "s-dir", POW(2, -24.0/168) / (POW(2, -240.0/168) + POW(2, -120.0/168) + POW(2, -48.0/168) + POW(2, -24.0/168))),
    STRUCT("G", "last_touch", "s-dir", 1.0),
    STRUCT("G", "last_non_direct", "s-email", 1.0),
    STRUCT("G", "first_touch", "s-org", 1.0),
    STRUCT("G", "linear", "s-org", 1.0/3),
    STRUCT("G", "linear", "s-email", 1.0/3),
    STRUCT("G", "linear", "s-dir", 1.0/3),
    STRUCT("G", "position_based", "s-org", 0.4),
    STRUCT("G", "position_based", "s-email", 0.2),
    STRUCT("G", "position_based", "s-dir", 0.4),
    STRUCT("G", "time_decay", "s-org", POW(2, -72.0/168) / (POW(2, -72.0/168) + POW(2, -24.0/168) + POW(2, -2.0/168))),
    STRUCT("G", "time_decay", "s-email", POW(2, -24.0/168) / (POW(2, -72.0/168) + POW(2, -24.0/168) + POW(2, -2.0/168))),
    STRUCT("G", "time_decay", "s-dir", POW(2, -2.0/168) / (POW(2, -72.0/168) + POW(2, -24.0/168) + POW(2, -2.0/168))),
    STRUCT("I", "linear", "s-one", 1.0),
    STRUCT("I", "first_touch", "s-one", 1.0),
    STRUCT("I", "last_touch", "s-one", 1.0),
    STRUCT("I", "last_non_direct", "s-one", 1.0),
    STRUCT("I", "position_based", "s-one", 1.0),
    STRUCT("I", "paid_only", "s-one", 1.0),
    STRUCT("I", "time_decay", "s-one", 1.0),
    STRUCT("J", "first_touch", "s-a", 1.0),
    STRUCT("J", "last_touch", "s-b", 1.0),
    STRUCT("J", "last_non_direct", "s-b", 1.0),
    STRUCT("J", "linear", "s-a", 0.5),
    STRUCT("J", "linear", "s-b", 0.5),
    STRUCT("J", "position_based", "s-a", 0.5),
    STRUCT("J", "position_based", "s-b", 0.5),
    STRUCT("J", "paid_only", "s-a", 1.0),
    STRUCT("J", "time_decay", "s-a", POW(2, -48.0/168) / (POW(2, -48.0/168) + POW(2, -2.0/168))),
    STRUCT("J", "time_decay", "s-b", POW(2, -2.0/168) / (POW(2, -48.0/168) + POW(2, -2.0/168))),
    STRUCT("K", "first_touch", "s-a-meta", 1.0),
    STRUCT("K", "last_touch", "s-b-email", 1.0),
    STRUCT("K", "last_non_direct", "s-b-email", 1.0),
    STRUCT("K", "linear", "s-a-meta", 0.5),
    STRUCT("K", "linear", "s-b-email", 0.5),
    STRUCT("K", "position_based", "s-a-meta", 0.5),
    STRUCT("K", "position_based", "s-b-email", 0.5),
    STRUCT("K", "paid_only", "s-a-meta", 1.0),
    STRUCT("K", "time_decay", "s-a-meta", 0.5),
    STRUCT("K", "time_decay", "s-b-email", 0.5)
  ])
),
compared AS (
  SELECT
    COALESCE(e.fixture_id, g.fixture_id) AS fixture_id,
    COALESCE(e.model_name, g.model_name) AS model_name,
    COALESCE(e.touchpoint_id, g.touchpoint_id) AS touchpoint_id,
    e.expected_credit,
    g.credit AS got_credit
  FROM expected AS e
  FULL OUTER JOIN got AS g
    ON e.fixture_id = g.fixture_id
   AND e.model_name = g.model_name
   AND e.touchpoint_id = g.touchpoint_id
),
mismatches AS (
  SELECT *
  FROM compared
  WHERE expected_credit IS NULL
     OR got_credit IS NULL
     OR ABS(got_credit - expected_credit) > 1e-6
)
SELECT
  (SELECT COUNT(*) FROM mismatches) AS mismatch_count,
  (SELECT COUNT(*) FROM expected) AS expected_rows,
  (SELECT COUNT(*) FROM got) AS got_rows,
  "VALIDATION REQUIRED — expect mismatch_count = 0. Paid_only on C/G must produce zero got rows (unexpected rows count as mismatches). Fixture D has no touches. Fixture K is a same-timestamp tie: first_touch = s-a-meta, last_touch = s-b-email, one row at 100% (touchpoint_id tie-break). Time-decay uses POW(2, -hours/168)." AS status;

-- If mismatch_count != 0, run:
-- SELECT * FROM mismatches ORDER BY fixture_id, model_name;
-- Paste that result back. Do not mark VALIDATED.
