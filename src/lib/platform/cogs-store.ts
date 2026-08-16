import { readDurableJson, writeDurableJson } from "@/lib/durable-json";
import { insertCogsRow, queryCogsLedger } from "@/lib/platform/cogs-bq";
import {
  type CogsLedgerRow,
  mergeCogsLedgers,
  normalizeCogsRow,
  upsertCogsRow,
} from "@/lib/platform/cogs-ledger";

const STORE = "cogs-daily";

type CogsFile = { rows: CogsLedgerRow[] };

async function readLocalLedger(): Promise<CogsLedgerRow[]> {
  const stored = await readDurableJson<CogsFile>(STORE);
  const rows = Array.isArray(stored?.rows) ? stored.rows : [];
  const parsed: CogsLedgerRow[] = [];
  for (const item of rows) {
    const row = normalizeCogsRow(item);
    if (row) parsed.push(row);
  }
  return parsed;
}

export async function loadCogsLedger(): Promise<CogsLedgerRow[]> {
  const [local, warehouse] = await Promise.all([
    readLocalLedger(),
    queryCogsLedger(),
  ]);
  return mergeCogsLedgers(local, warehouse);
}

export async function saveCogsDay(input: {
  date: string;
  amount: unknown;
  note?: unknown;
}): Promise<{ ok: true; row: CogsLedgerRow } | { ok: false; message: string }> {
  const row = normalizeCogsRow({
    date: input.date,
    amount: input.amount,
    note: input.note,
    updatedAt: new Date().toISOString(),
  });
  if (!row) {
    return {
      ok: false,
      message: "Enter a Pacific YYYY-MM-DD date and an amount greater than 0.",
    };
  }
  const next = upsertCogsRow(await loadCogsLedger(), row);
  await writeDurableJson(STORE, { rows: next });
  try {
    await insertCogsRow(row);
  } catch (error) {
    console.warn("[cogs] BigQuery insert failed; cookie/file still saved:", error);
  }
  return { ok: true, row };
}
