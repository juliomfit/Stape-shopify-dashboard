export type CogsLedgerRow = {
  date: string;
  amount: number;
  note?: string;
  updatedAt: string;
};

export type CogsRangeResult = {
  /** Sum of entered amounts in range. Only use for profit when `complete`. */
  cogsForRange: number | null;
  complete: boolean;
  missingDates: string[];
  enteredDates: string[];
  rowCount: number;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isPacificYmd(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() + 1 === month &&
    check.getUTCDate() === day
  );
}

function daysInclusive(startDate: string, endDate: string): string[] {
  if (!isPacificYmd(startDate) || !isPacificYmd(endDate) || startDate > endDate) {
    return [];
  }
  const days: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const last = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

export function normalizeCogsRow(
  input: unknown,
): CogsLedgerRow | null {
  if (!input || typeof input !== "object") return null;
  const rec = input as Record<string, unknown>;
  const date = typeof rec.date === "string" ? rec.date.trim() : "";
  if (!isPacificYmd(date)) return null;
  const amount = parseAmount(rec.amount);
  if (amount === null || amount <= 0) return null;
  const updatedAt =
    typeof rec.updatedAt === "string" && rec.updatedAt.trim()
      ? rec.updatedAt
      : new Date().toISOString();
  const noteRaw =
    typeof rec.note === "string" ? rec.note.trim() : undefined;
  return {
    date,
    amount,
    updatedAt,
    ...(noteRaw ? { note: noteRaw } : {}),
  };
}

export function upsertCogsRow(
  rows: CogsLedgerRow[],
  next: CogsLedgerRow,
): CogsLedgerRow[] {
  const rest = rows.filter((r) => r.date !== next.date);
  return [...rest, next].sort((a, b) => a.date.localeCompare(b.date));
}

export function latestRowByDate(rows: CogsLedgerRow[]): CogsLedgerRow[] {
  const map = new Map<string, CogsLedgerRow>();
  for (const row of rows) {
    const prev = map.get(row.date);
    if (!prev || prev.updatedAt < row.updatedAt) map.set(row.date, row);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeCogsLedgers(
  a: CogsLedgerRow[],
  b: CogsLedgerRow[],
): CogsLedgerRow[] {
  return latestRowByDate([...a, ...b]);
}

/**
 * Sum supplier COGS for Pacific days in [startDate, endDate].
 * Missing days ⇒ incomplete; `cogsForRange` is then null (never $0).
 */
export function cogsForPacificRange(
  rows: CogsLedgerRow[],
  startDate: string,
  endDate: string,
): CogsRangeResult {
  const days = daysInclusive(startDate, endDate);
  const byDate = new Map(latestRowByDate(rows).map((r) => [r.date, r]));
  const missingDates: string[] = [];
  const enteredDates: string[] = [];
  let sum = 0;
  for (const day of days) {
    const row = byDate.get(day);
    if (!row) {
      missingDates.push(day);
      continue;
    }
    enteredDates.push(day);
    sum += row.amount;
  }
  const complete = days.length > 0 && missingDates.length === 0;
  return {
    cogsForRange: complete ? sum : null,
    complete,
    missingDates,
    enteredDates,
    rowCount: enteredDates.length,
  };
}

export function lastEnteredDays(
  rows: CogsLedgerRow[],
  limit = 14,
): CogsLedgerRow[] {
  return latestRowByDate(rows)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function cogsSourceLine(enteredDates: string[]): string {
  if (enteredDates.length === 0) return "";
  const first = enteredDates[0];
  const last = enteredDates[enteredDates.length - 1];
  const span = first === last ? first : `${first} → ${last}`;
  return `incl. supplier COGS · ${span}`;
}
