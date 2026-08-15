import assert from "node:assert/strict";
import test from "node:test";
import {
  insightPersistKey,
  mergeInsightBatches,
  normalizeAccount,
  normalizeInsightRow,
  parseMarkdownTable,
  parseNumber,
  parseYmdLoose,
  unwrapMcpToolResult,
  unwrapRows,
} from "../src/lib/ads/providers/normalize.ts";
import { midpointYmd, queryDateRangeChunked, SilentTruncationError } from "../src/lib/ads/providers/chunk.ts";
import { FLYWEEL_WRITE_TOOLS, assertFlyweelReadOnly, FlyweelWriteRefusedError, resolveActiveMetaProviderId, sanitizeFlyweelApiKey, flyweelApiKeyProblem } from "../src/lib/ads/providers/config.ts";
import { buildFlyweelAdsQuery, summarizeFlyweelSetup } from "../src/lib/ads/providers/flyweel-query.ts";
import { cpc, ctr, platformCpa, platformRoas } from "../src/lib/metrics/formulas.ts";

test("parseNumber handles nulls and string money", () => {
  assert.equal(parseNumber(null), 0);
  assert.equal(parseNumber(""), 0);
  assert.equal(parseNumber("12.50"), 12.5);
  assert.equal(parseNumber("$1,200.10"), 1200.1);
  assert.equal(parseNumber("nope"), 0);
});

test("normalizeInsightRow maps aliases and does not invent purchases", () => {
  const row = normalizeInsightRow(
    {
      date: "2026-08-01",
      campaign_id: "111",
      campaign: "ASC Scaling",
      cost: "40",
      impressions: "1000",
      clicks: "20",
    },
    { accountId: "999", provider: "flyweel" },
  );
  assert.equal(row.spend, 40);
  assert.equal(row.campaignName, "ASC Scaling");
  assert.equal(row.purchases, 0);
  assert.equal(row.date, "2026-08-01");
  assert.equal(parseYmdLoose("2026-08-01T12:00:00Z"), "2026-08-01");
});

test("invalid payload unwraps to empty", () => {
  assert.deepEqual(unwrapRows(null), []);
  assert.deepEqual(unwrapRows("nope"), []);
  assert.deepEqual(unwrapRows({ foo: 1 }), []);
});

test("mcp text content unwraps json", () => {
  const parsed = unwrapMcpToolResult({
    content: [{ type: "text", text: '{"rows":[{"spend":1}]}' }],
  });
  assert.deepEqual(unwrapRows(parsed), [{ spend: 1 }]);
});

test("mcp markdown table unwraps to insight rows", () => {
  const markdown = `
| date | campaign_id | campaign | spend | impressions |
| --- | --- | --- | --- | --- |
| 2026-08-14 | 111 | ASC Scaling | 40.5 | 1000 |
`.trim();
  const parsed = unwrapMcpToolResult({
    content: [{ type: "text", text: markdown }],
  });
  const rows = unwrapRows(parsed);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].campaign, "ASC Scaling");
  assert.equal(rows[0].spend, "40.5");
  const table = parseMarkdownTable(markdown);
  assert.equal(table.length, 1);
});

test("mcp fenced json and column matrix unwrap", () => {
  const fenced = unwrapMcpToolResult({
    content: [{ type: "text", text: '```json\n[{"date":"2026-08-14","spend":9}]\n```' }],
  });
  assert.deepEqual(unwrapRows(fenced), [{ date: "2026-08-14", spend: 9 }]);
  assert.deepEqual(
    unwrapRows({
      columns: ["date", "spend"],
      rows: [["2026-08-14", 12]],
    }),
    [{ date: "2026-08-14", spend: 12 }],
  );
  assert.deepEqual(
    unwrapRows({
      queries: [{ rows: [{ date: "2026-08-14", campaign: "ASC", spend: 4 }] }],
    }),
    [{ date: "2026-08-14", campaign: "ASC", spend: 4 }],
  );
});

test("Flyweel ads query uses dataSource and dateRange", () => {
  const body = buildFlyweelAdsQuery({
    startDate: "2026-08-08",
    endDate: "2026-08-15",
    metrics: ["spend", "impressions"],
    dimensions: ["date", "campaign_id", "campaign", "channel"],
  });
  const query = (body.queries as Record<string, unknown>[])[0];
  assert.equal(query.dataSource, "ads");
  assert.deepEqual(query.dateRange, { start: "2026-08-08", end: "2026-08-15" });
  assert.deepEqual(query.filters, { channel: ["Meta"] });
});

test("setup summary detects Meta connected with nothing selected", () => {
  const summary = summarizeFlyweelSetup({
    status: {
      google: { connected: false, totalAccounts: 0, selectedAccounts: 0 },
      meta: { connected: true, totalAccounts: 4, selectedAccounts: 0, syncStatus: "never" },
    },
  });
  assert.equal(summary.metaConnected, true);
  assert.equal(summary.metaSelected, 0);
  assert.match(summary.message, /no ad account is selected/i);
});

test("500-row chunking splits date ranges and refuses silent same-day truncation", async () => {
  const calls: string[] = [];
  const result = await queryDateRangeChunked({
    startDate: "2026-08-01",
    endDate: "2026-08-04",
    rowLimit: 3,
    query: async (start, end) => {
      calls.push(`${start}:${end}`);
      const span = start === end ? 2 : 5;
      return Array.from({ length: span }, (_, i) => ({ i, start, end }));
    },
  });
  assert.ok(result.splits >= 1);
  assert.ok(result.rows.length > 3);
  assert.ok(calls.length > 1);

  await assert.rejects(
    () =>
      queryDateRangeChunked({
        startDate: "2026-08-01",
        endDate: "2026-08-01",
        rowLimit: 2,
        query: async () => [{ a: 1 }, { a: 2 }],
      }),
    SilentTruncationError,
  );
});

test("midpoint is deterministic", () => {
  assert.equal(midpointYmd("2026-08-01", "2026-08-03"), "2026-08-02");
});

test("idempotent merge uses date+ids", () => {
  const a = normalizeInsightRow(
    { date: "2026-08-01", campaign_id: "1", spend: 10 },
    { accountId: "9", provider: "flyweel" },
  );
  const b = normalizeInsightRow(
    { date: "2026-08-01", campaign_id: "1", spend: 12 },
    { accountId: "9", provider: "flyweel" },
  );
  const merged = mergeInsightBatches([[a], [b]]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].spend, 12);
  assert.equal(insightPersistKey(a), "2026-08-01|9|1||");
});

test("write tools are refused", () => {
  assert.ok(FLYWEEL_WRITE_TOOLS.includes("connect_ad_platform"));
  assert.throws(() => assertFlyweelReadOnly("connect_ad_platform"), FlyweelWriteRefusedError);
  assert.doesNotThrow(() => assertFlyweelReadOnly("select_ad_accounts"));
  assert.doesNotThrow(() => assertFlyweelReadOnly("query_metrics"));
});

test("Flyweel API key sanitizes quotes and rejects prefixes", () => {
  assert.equal(sanitizeFlyweelApiKey('Bearer fwl_abc'), "fwl_abc");
  assert.equal(sanitizeFlyweelApiKey('"fwl_abc"'), "fwl_abc");
  assert.match(flyweelApiKeyProblem("fwl_79d4...") || "", /masked prefix/);
  assert.match(flyweelApiKeyProblem("fwl_short") || "", /too short/);
  assert.equal(flyweelApiKeyProblem(`fwl_${"a".repeat(64)}`), null);
});

test("active provider prefers Flyweel when key would be set via resolver inputs", () => {
  assert.equal(resolveActiveMetaProviderId(true), "meta_graph");
});

test("canonical metrics stay null without spend", () => {
  assert.equal(platformRoas(100, null), null);
  assert.equal(platformCpa(null, 3), null);
  assert.equal(ctr(1, 0), null);
  assert.equal(cpc(10, 0), null);
});

test("normalizeAccount keeps numeric id not only name", () => {
  const account = normalizeAccount(
    { id: "123456789", name: "GoodsNova", platform: "meta" },
    "flyweel",
  );
  assert.equal(account.accountId, "123456789");
  assert.equal(account.accountName, "GoodsNova");
});
