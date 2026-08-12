/** Shared BigQuery SQL for first-party channel grouping. */
export const CHANNEL_SQL = `
  CASE
    WHEN IFNULL(gclid, '') != ''
      OR page_location LIKE '%gclid=%'
      OR page_location LIKE '%wbraid=%'
      OR page_location LIKE '%gbraid=%'
      OR (
        REGEXP_CONTAINS(page_location, r'[?&]utm_source=google')
        AND REGEXP_CONTAINS(page_location, r'[?&]utm_medium=(cpc|ppc|paid|paidsearch)')
      )
      THEN 'Google Ads'
    WHEN IFNULL(fbclid, '') != ''
      OR IFNULL(fbc, '') != ''
      OR page_location LIKE '%fbclid=%'
      OR REGEXP_CONTAINS(page_location, r'[?&]utm_source=(facebook|fb|ig|instagram|meta)')
      THEN 'Facebook / Meta Ads'
    WHEN page_referrer LIKE '%google.'
      OR page_referrer LIKE '%google.com%'
      THEN 'Google Organic'
    WHEN page_referrer LIKE '%facebook%'
      OR page_referrer LIKE '%instagram%'
      OR page_referrer LIKE '%l.facebook%'
      THEN 'Meta Organic'
    WHEN IFNULL(page_referrer, '') = ''
      OR (
        IFNULL(page_location, '') != ''
        AND STRPOS(page_referrer, NET.HOST(page_location)) > 0
      )
      THEN 'Direct'
    ELSE 'Other'
  END
`;
