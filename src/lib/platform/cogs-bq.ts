import {
  insertRows,
  isPlatformBqReady,
  runPlatformQuery,
} from "@/lib/platform/bq";
import { platformTable } from "@/lib/platform/config";
import type { CogsLedgerRow } from "@/lib/platform/cogs-ledger";
import { latestRowByDate, normalizeCogsRow } from "@/lib/platform/cogs-ledger";

export const COGS_TABLE = "raw_cogs_daily";

function bqDateString(raw: unknown): string {
  if (typeof raw === "string") return raw.slice(0, 10);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (raw && typeof raw === "object" && "value" in raw) {
    return String((raw as { value: string }).value).slice(0, 10);
  }
  return "";
}

function bqIso(raw: unknown): string {
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "string" && raw.trim()) return raw;
  if (raw && typeof raw === "object" && "value" in raw) {
    return String((raw as { value: string }).value);
  }
  return new Date().toISOString();
}

export async function ensureCogsTable(): Promise<boolean> {
  const table = platformTable(COGS_TABLE);
  if (!table || !isPlatformBqReady()) return false;
  await runPlatformQuery(`
    CREATE TABLE IF NOT EXISTS ${table} (
      date DATE NOT NULL,
      amount FLOAT64 NOT NULL,
      note STRING,
      updated_at TIMESTAMP NOT NULL
    )
  `);
  return true;
}

export async function insertCogsRow(row: CogsLedgerRow): Promise<void> {
  const ok = await ensureCogsTable();
  if (!ok) return;
  await insertRows(COGS_TABLE, [
    {
      date: row.date,
      amount: row.amount,
      note: row.note ?? null,
      updated_at: row.updatedAt,
    },
  ]);
}

export async function queryCogsLedger(): Promise<CogsLedgerRow[]> {
  try {
    const table = platformTable(COGS_TABLE);
    if (!table || !isPlatformBqReady()) return [];
    await ensureCogsTable();
    const rows = await runPlatformQuery<Record<string, unknown>>(`
      SELECT date, amount, note, updated_at
      FROM (
        SELECT
          date,
          amount,
          note,
          updated_at,
          ROW_NUMBER() OVER (PARTITION BY date ORDER BY updated_at DESC) AS rn
        FROM ${table}
      )
      WHERE rn = 1
      ORDER BY date
    `);
    const parsed: CogsLedgerRow[] = [];
    for (const raw of rows) {
      const row = normalizeCogsRow({
        date: bqDateString(raw.date),
        amount: Number(raw.amount),
        note: raw.note,
        updatedAt: bqIso(raw.updated_at),
      });
      if (row) parsed.push(row);
    }
    return latestRowByDate(parsed);
  } catch (error) {
    console.warn("[cogs] BigQuery ledger unavailable:", error);
    return [];
  }
}
