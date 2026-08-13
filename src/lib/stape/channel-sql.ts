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
] as const;

export type AttributionChannel = (typeof ATTRIBUTION_CHANNELS)[number];

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
    WHEN REGEXP_CONTAINS(page_location, r'[?&]utm_medium=(email|sms)')
      OR REGEXP_CONTAINS(page_location, r'[?&]utm_source=(klaviyo|omnisend|email|sms|postscript|attentive)')
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
    WHEN page_location LIKE '%web-pixels@%'
      OR page_location LIKE '%/checkouts/%'
      OR page_location LIKE '%/checkout%'
      THEN 'Direct'
    WHEN IFNULL(page_referrer, '') = ''
      OR (
        IFNULL(page_location, '') != ''
        AND STRPOS(IFNULL(page_referrer, ''), IFNULL(NET.HOST(page_location), '')) > 0
      )
      THEN 'Direct'
    ELSE 'Other'
  END
`;
