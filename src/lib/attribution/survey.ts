export type SurveyAttributionRow = {
  orderId: string;
  customerId: string | null;
  surveySource: string;
  response: string;
  timestamp: string;
};

/**
 * Zero-party post-purchase survey storage contract.
 * Survey answers MUST NOT overwrite deterministic click attribution.
 * Display later as Tracked Attribution vs Survey Attribution.
 */
export const SURVEY_ATTRIBUTION_NOTE =
  "Survey attribution is stored separately from click attribution. A survey answer never replaces first-party credit.";
