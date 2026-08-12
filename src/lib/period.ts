export const OVERVIEW_DAYS = 30;

export function overviewPeriodLabel() {
  return `Last ${OVERVIEW_DAYS} days`;
}

export function startDateIso(days = OVERVIEW_DAYS) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
