import { EMAIL_MEDIUM_SQL, EMAIL_SOURCE_SQL } from "@/lib/tracking/observed-source";

/** Shared BigQuery SQL for first-party channel grouping. */
export const ATTRIBUTION_CHANNELS = [
  "Google Ads",
  "Facebook / Meta Ads",
  "TikTok",
  "Microsoft Ads",
  "Google Organic",
  "Meta Organic",
  "Email",
  "Direct",
  "Other",
  "Unknown",
] as const;

export type AttributionChannel = (typeof ATTRIBUTION_CHANNELS)[number];

/**
 * Internal / checkout noise — NOT Direct, NOT an attribution touch.
 * Must stay in lockstep with `src/lib/attribution/eligibility.ts`.
 */
export const INTERNAL_NOISE_SQL = `
  (
    IFNULL(page_location, '') LIKE '%web-pixels@%'
    OR IFNULL(page_location, '') LIKE '%/checkouts/%'
    OR IFNULL(page_location, '') LIKE '%/checkout%'
    OR REGEXP_CONTAINS(IFNULL(page_referrer, ''), r'(?i)(checkout\\.shopify|shopifycs\\.com|pay\\.shopify|shop\\.app|paypal\\.com|paypal\\.me|stripe\\.com|klarna\\.com|afterpay\\.com)')
    OR (
      IFNULL(NET.HOST(page_location), '') != ''
      AND IFNULL(NET.HOST(page_referrer), '') != ''
      AND (
        REGEXP_REPLACE(IFNULL(NET.HOST(page_location), ''), r'^www\\.', '')
          = REGEXP_REPLACE(IFNULL(NET.HOST(page_referrer), ''), r'^www\\.', '')
        OR ENDS_WITH(
          REGEXP_REPLACE(IFNULL(NET.HOST(page_location), ''), r'^www\\.', ''),
          CONCAT('.', REGEXP_REPLACE(IFNULL(NET.HOST(page_referrer), ''), r'^www\\.', ''))
        )
        OR ENDS_WITH(
          REGEXP_REPLACE(IFNULL(NET.HOST(page_referrer), ''), r'^www\\.', ''),
          CONCAT('.', REGEXP_REPLACE(IFNULL(NET.HOST(page_location), ''), r'^www\\.', ''))
        )
      )
      AND IFNULL(gclid, '') = ''
      AND IFNULL(gbraid, '') = ''
      AND IFNULL(wbraid, '') = ''
      AND IFNULL(dclid, '') = ''
      AND IFNULL(fbclid, '') = ''
      AND IFNULL(fbc, '') = ''
      AND IFNULL(ttclid, '') = ''
      AND IFNULL(msclkid, '') = ''
      AND NOT REGEXP_CONTAINS(IFNULL(page_location, ''), r'[?&]utm_source=[^&]+')
      AND NOT REGEXP_CONTAINS(IFNULL(page_location, ''), r'[?&](gclid|gbraid|wbraid|dclid|fbclid|ttclid|msclkid)=')
    )
  )
`;

export const PAID_CHANNELS: readonly AttributionChannel[] = [
  "Google Ads",
  "Facebook / Meta Ads",
  "TikTok",
  "Microsoft Ads",
];

export const ORGANIC_CHANNELS: readonly AttributionChannel[] = [
  "Google Organic",
  "Meta Organic",
  "Email",
  "Direct",
  "Other",
];

export const CHANNEL_SQL = `
  CASE
    WHEN IFNULL(gclid, '') != ''
      OR IFNULL(gbraid, '') != ''
      OR IFNULL(wbraid, '') != ''
      OR IFNULL(dclid, '') != ''
      OR page_location LIKE '%gclid=%'
      OR page_location LIKE '%wbraid=%'
      OR page_location LIKE '%gbraid=%'
      OR page_location LIKE '%dclid=%'
      OR (
        REGEXP_CONTAINS(page_location, r'[?&]utm_source=google')
        AND REGEXP_CONTAINS(page_location, r'[?&]utm_medium=(cpc|ppc|paid|paidsearch|paid_search)')
      )
      THEN 'Google Ads'
    WHEN IFNULL(fbclid, '') != ''
      OR IFNULL(fbc, '') != ''
      OR page_location LIKE '%fbclid=%'
      OR (
        REGEXP_CONTAINS(page_location, r'[?&]utm_source=(facebook|fb|ig|instagram|meta)')
        AND REGEXP_CONTAINS(page_location, r'[?&]utm_medium=(cpc|ppc|paid|paidsocial|paid_social|paid-social)')
      )
      THEN 'Facebook / Meta Ads'
    WHEN IFNULL(ttclid, '') != ''
      OR page_location LIKE '%ttclid=%'
      OR REGEXP_CONTAINS(page_location, r'[?&]utm_source=tiktok')
      THEN 'TikTok'
    WHEN IFNULL(msclkid, '') != ''
      OR page_location LIKE '%msclkid=%'
      OR REGEXP_CONTAINS(page_location, r'[?&]utm_source=(bing|microsoft)')
      THEN 'Microsoft Ads'
    WHEN REGEXP_CONTAINS(page_location, r'[?&]utm_medium=(${EMAIL_MEDIUM_SQL})')
      OR REGEXP_CONTAINS(page_location, r'[?&]utm_source=(${EMAIL_SOURCE_SQL})')
      THEN 'Email'
    WHEN REGEXP_CONTAINS(page_location, r'[?&]utm_source=(facebook|fb|ig|instagram|meta)')
      OR page_referrer LIKE '%facebook%'
      OR page_referrer LIKE '%instagram%'
      OR page_referrer LIKE '%l.facebook%'
      THEN 'Meta Organic'
    WHEN REGEXP_CONTAINS(page_location, r'[?&]utm_source=google')
      OR page_referrer LIKE '%google.'
      OR page_referrer LIKE '%google.com%'
      OR page_referrer LIKE '%youtube.com%'
      THEN 'Google Organic'
    WHEN REGEXP_CONTAINS(IFNULL(page_location, ''), r'[?&]utm_source=[^&]+')
      THEN 'Other'
    WHEN IFNULL(page_location, '') != ''
      AND IFNULL(page_location, '') NOT LIKE '%web-pixels@%'
      AND IFNULL(page_location, '') NOT LIKE '%/checkouts/%'
      AND IFNULL(page_location, '') NOT LIKE '%/checkout%'
      AND IFNULL(page_referrer, '') = ''
      THEN 'Direct'
    WHEN IFNULL(page_referrer, '') != ''
      AND (
        IFNULL(page_location, '') = ''
        OR STRPOS(IFNULL(page_referrer, ''), IFNULL(NET.HOST(page_location), '')) = 0
      )
      THEN 'Other'
    ELSE 'Unknown'
  END
`;

/** Raw utm_source / click-id / referrer host. New tools appear without a dashboard allowlist. */
export const OBSERVED_SOURCE_SQL = `
  CASE
    WHEN REGEXP_CONTAINS(IFNULL(page_location, ''), r'[?&]utm_source=[^&]+')
      THEN LOWER(TRIM(REGEXP_REPLACE(
        IFNULL(REGEXP_EXTRACT(page_location, r'[?&]utm_source=([^&#]+)'), ''),
        r'%20',
        ' '
      )))
    WHEN IFNULL(gclid, '') != ''
      OR IFNULL(gbraid, '') != ''
      OR IFNULL(wbraid, '') != ''
      OR IFNULL(dclid, '') != ''
      OR page_location LIKE '%gclid=%'
      OR page_location LIKE '%wbraid=%'
      OR page_location LIKE '%gbraid=%'
      OR page_location LIKE '%dclid=%'
      THEN 'google'
    WHEN IFNULL(fbclid, '') != ''
      OR IFNULL(fbc, '') != ''
      OR page_location LIKE '%fbclid=%'
      THEN 'facebook'
    WHEN IFNULL(ttclid, '') != ''
      OR page_location LIKE '%ttclid=%'
      THEN 'tiktok'
    WHEN IFNULL(msclkid, '') != ''
      OR page_location LIKE '%msclkid=%'
      THEN 'microsoft'
    WHEN IFNULL(page_referrer, '') != ''
      AND (
        IFNULL(page_location, '') = ''
        OR STRPOS(IFNULL(page_referrer, ''), IFNULL(NET.HOST(page_location), '')) = 0
      )
      THEN LOWER(IFNULL(NET.HOST(page_referrer), 'direct'))
    ELSE 'direct'
  END
`;
