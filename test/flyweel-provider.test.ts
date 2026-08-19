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
import { FLYWEEL_WRITE_TOOLS, FLYWEEL_CAMPAIGN_ONLY_WARNING, assertFlyweelReadOnly, FlyweelWriteRefusedError, flyweelCampaignOnlyWarning, flyweelDeepIngestEnabled, metaInsightLevelsToFetch, resolveActiveMetaProviderId, sanitizeFlyweelApiKey, flyweelApiKeyProblem, shouldFetchDeepMetaInsights } from "../src/lib/ads/providers/config.ts";
import { buildFlyweelAdsQuery, summarizeFlyweelSetup } from "../src/lib/ads/providers/flyweel-query.ts";
import { formatMetaFactTableCounts } from "../src/lib/ads/meta-fact-format.ts";
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
  assert.equal(parseYmdLoose("08/14/2026"), "2026-08-14");
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

test("Flyweel title-case rows, CSV summary, and MCP content beat empty structuredContent", () => {
  const titled = unwrapRows({
    organization: { id: "org", name: "goodsnova" },
    results: [
      {
        queryIndex: 0,
        success: true,
        data: {
          summary: "Data source: ads\nShowing: 500 of 2814 rows",
          rows: [
            {
              Date: "08/14/2026",
              "Campaign ID": "111",
              Campaign: "ASC Scaling",
              Spend: 40.5,
              Impressions: 1000,
            },
          ],
        },
      },
    ],
  });
  assert.equal(titled.length, 1);
  const normalized = normalizeInsightRow(titled[0], { accountId: "209273195421975", provider: "flyweel" });
  assert.equal(normalized.date, "2026-08-14");
  assert.equal(normalized.campaignId, "111");
  assert.equal(normalized.spend, 40.5);

  const csvOnly = unwrapRows({
    results: [
      {
        queryIndex: 0,
        success: true,
        data: {
          summary:
            "Data source: ads\nShowing: 2 of 2 rows\ndate,campaign_id,campaign,spend\n2026-08-14,111,ASC,12.5\n2026-08-13,111,ASC,8",
        },
      },
    ],
  });
  assert.equal(csvOnly.length, 2);
  assert.equal(csvOnly[0].spend, "12.5");

  const mcp = unwrapMcpToolResult({
    structuredContent: {
      organization: { name: "goodsnova" },
      results: [{ queryIndex: 0, success: true, data: { summary: "Showing: 500 of 2814 rows" } }],
    },
    content: [
      {
        type: "text",
        text: "| date | campaign | spend |\n| --- | --- | --- |\n| 2026-08-14 | ASC | 9 |",
      },
    ],
  });
  const fromMcp = unwrapRows(mcp);
  assert.equal(fromMcp.length, 1);
  assert.equal(fromMcp[0].campaign, "ASC");
});

test("truncated JSON still yields complete row objects", () => {
  const rows = unwrapRows(
    '{"results":[{"data":{"rows":[{"date":"2026-08-14","campaign":"ASC","spend":9},{"date":"2026-08-13","campaign":"ASC","spend":',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].spend, 9);
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

test("Flyweel campaign-only vs all-level ingest", () => {
  const prev = process.env.FLYWEEL_INGEST_LEVELS;
  try {
    delete process.env.FLYWEEL_INGEST_LEVELS;
    assert.equal(flyweelDeepIngestEnabled(), false);
    assert.equal(shouldFetchDeepMetaInsights("flyweel"), false);
    assert.deepEqual(metaInsightLevelsToFetch("flyweel"), ["campaign"]);
    assert.equal(flyweelCampaignOnlyWarning("flyweel"), FLYWEEL_CAMPAIGN_ONLY_WARNING);
    assert.equal(
      flyweelCampaignOnlyWarning("flyweel"),
      "Campaign-only Meta ingest — ad set/ad deterministic attribution unavailable.",
    );
    assert.equal(shouldFetchDeepMetaInsights("meta_graph"), true);
    assert.deepEqual(metaInsightLevelsToFetch("meta_graph"), ["campaign", "adset", "ad"]);
    assert.equal(flyweelCampaignOnlyWarning("meta_graph"), null);

    process.env.FLYWEEL_INGEST_LEVELS = "all";
    assert.equal(flyweelDeepIngestEnabled(), true);
    assert.equal(shouldFetchDeepMetaInsights("flyweel"), true);
    assert.deepEqual(metaInsightLevelsToFetch("flyweel"), ["campaign", "adset", "ad"]);
    assert.equal(flyweelCampaignOnlyWarning("flyweel"), null);

    process.env.FLYWEEL_INGEST_LEVELS = "campaign";
    assert.equal(shouldFetchDeepMetaInsights("flyweel"), false);
    assert.deepEqual(metaInsightLevelsToFetch("flyweel"), ["campaign"]);
    assert.equal(flyweelCampaignOnlyWarning("flyweel"), FLYWEEL_CAMPAIGN_ONLY_WARNING);

    process.env.FLYWEEL_INGEST_LEVELS = "ALL";
    assert.equal(shouldFetchDeepMetaInsights("flyweel"), false);
    process.env.FLYWEEL_INGEST_LEVELS = " all ";
    assert.equal(shouldFetchDeepMetaInsights("flyweel"), false);
  } finally {
    if (prev === undefined) delete process.env.FLYWEEL_INGEST_LEVELS;
    else process.env.FLYWEEL_INGEST_LEVELS = prev;
  }
});

test("fact table count formatter never invents a zero for unavailable tables", () => {
  assert.equal(
    formatMetaFactTableCounts({
      available: false,
      campaigns: null,
      adsets: null,
      ads: null,
    }),
    null,
  );
  assert.equal(
    formatMetaFactTableCounts({
      available: true,
      campaigns: 15,
      adsets: 0,
      ads: 0,
    }),
    "meta_campaign_insights_daily=15 · meta_adset_insights_daily=0 · meta_ad_insights_daily=0",
  );
  assert.equal(
    formatMetaFactTableCounts({
      available: true,
      campaigns: 15,
      adsets: null,
      ads: 0,
    }),
    null,
  );
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
