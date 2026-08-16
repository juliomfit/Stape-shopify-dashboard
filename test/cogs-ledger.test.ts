import assert from "node:assert/strict";
import test from "node:test";
import {
  cogsForPacificRange,
  cogsSourceLine,
  lastEnteredDays,
  mergeCogsLedgers,
  upsertCogsRow,
  type CogsLedgerRow,
} from "../src/lib/platform/cogs-ledger.ts";

function row(date: string, amount: number, updatedAt = "2026-08-16T00:00:00.000Z"): CogsLedgerRow {
  return { date, amount, updatedAt };
}

test("missing day in range ⇒ cogs null not 0", () => {
  const rows = [
    row("2026-08-10", 10),
    row("2026-08-11", 20),
    row("2026-08-12", 30),
    row("2026-08-13", 40),
    row("2026-08-14", 50),
    row("2026-08-15", 60),
  ];
  const result = cogsForPacificRange(rows, "2026-08-10", "2026-08-16");
  assert.equal(result.complete, false);
  assert.equal(result.cogsForRange, null);
  assert.deepEqual(result.missingDates, ["2026-08-16"]);
  assert.equal(result.rowCount, 6);
});

test("full 7d with 7 rows ⇒ sum", () => {
  const rows = [
    row("2026-08-10", 10),
    row("2026-08-11", 20),
    row("2026-08-12", 30),
    row("2026-08-13", 40),
    row("2026-08-14", 50),
    row("2026-08-15", 60),
    row("2026-08-16", 70),
  ];
  const result = cogsForPacificRange(rows, "2026-08-10", "2026-08-16");
  assert.equal(result.complete, true);
  assert.equal(result.cogsForRange, 280);
  assert.deepEqual(result.missingDates, []);
  assert.equal(cogsSourceLine(result.enteredDates), "incl. supplier COGS · 2026-08-10 → 2026-08-16");
});

test("replace same date updates amount", () => {
  const first = upsertCogsRow([], row("2026-08-15", 40, "2026-08-15T20:00:00.000Z"));
  const replaced = upsertCogsRow(first, row("2026-08-15", 55, "2026-08-16T02:00:00.000Z"));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].amount, 55);
  const merged = mergeCogsLedgers(first, replaced);
  assert.equal(merged[0].amount, 55);
  const range = cogsForPacificRange(replaced, "2026-08-15", "2026-08-15");
  assert.equal(range.cogsForRange, 55);
});

test("partial entered days are never summed into cogsForRange", () => {
  const rows = [row("2026-08-15", 99)];
  const result = cogsForPacificRange(rows, "2026-08-10", "2026-08-16");
  assert.equal(result.cogsForRange, null);
  assert.equal(result.rowCount, 1);
});

test("lastEnteredDays is newest first and capped", () => {
  const rows = Array.from({ length: 16 }, (_, i) =>
    row(`2026-08-${String(i + 1).padStart(2, "0")}`, i + 1),
  );
  const last = lastEnteredDays(rows, 14);
  assert.equal(last.length, 14);
  assert.equal(last[0].date, "2026-08-16");
  assert.equal(last[13].date, "2026-08-03");
});
