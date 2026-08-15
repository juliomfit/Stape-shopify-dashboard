function parseYmd(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export class SilentTruncationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SilentTruncationError";
  }
}

export function addDaysYmd(date: string, delta: number) {
  const parts = parseYmd(date);
  if (!parts) {
    return date;
  }
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + delta));
  return ymd(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

export function midpointYmd(startDate: string, endDate: string) {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end) {
    return startDate;
  }
  const startMs = Date.UTC(start.year, start.month - 1, start.day);
  const endMs = Date.UTC(end.year, end.month - 1, end.day);
  const mid = new Date(startMs + Math.floor((endMs - startMs) / 2));
  return ymd(mid.getUTCFullYear(), mid.getUTCMonth() + 1, mid.getUTCDate());
}

export async function queryDateRangeChunked<T>(input: {
  startDate: string;
  endDate: string;
  query: (startDate: string, endDate: string) => Promise<T[]>;
  rowLimit?: number;
  onSplit?: (startDate: string, endDate: string, rows: number) => void;
}): Promise<{ rows: T[]; requests: number; splits: number; truncated: boolean }> {
  const limit = input.rowLimit ?? 500;
  let requests = 0;
  let splits = 0;

  async function walk(startDate: string, endDate: string): Promise<T[]> {
    requests += 1;
    const rows = await input.query(startDate, endDate);
    if (rows.length < limit) {
      return rows;
    }
    if (startDate === endDate) {
      throw new SilentTruncationError(
        `Query returned ${rows.length} rows for ${startDate} (limit ${limit}). Split by campaign/ad before ingesting.`,
      );
    }
    splits += 1;
    input.onSplit?.(startDate, endDate, rows.length);
    const mid = midpointYmd(startDate, endDate);
    const leftEnd = mid;
    const rightStart = addDaysYmd(mid, 1);
    if (rightStart > endDate) {
      throw new SilentTruncationError(
        `Unable to split ${startDate}–${endDate} further after hitting ${limit} rows.`,
      );
    }
    const left = await walk(startDate, leftEnd);
    const right = await walk(rightStart, endDate);
    return [...left, ...right];
  }

  const rows = await walk(input.startDate, input.endDate);
  return { rows, requests, splits, truncated: false };
}
