import type { PlatformClaim } from "@/lib/ads/types";
import type { DashboardPeriod } from "@/lib/period";
import { readDurableJson, writeDurableJson } from "@/lib/durable-json";

export type CampaignSpendRow = {
  campaign: string;
  spend: number;
  purchases: number | null;
  revenue: number | null;
};

export type SpendPaste = {
  spend: number | null;
  purchases: number | null;
  revenue: number | null;
  campaigns?: CampaignSpendRow[];
};

export type PeriodSpendPaste = SpendPaste & {
  startDate: string;
  endDate: string;
  label: string;
};

export type SpendCoverageRow = {
  platform: "facebook" | "google";
  startDate: string;
  endDate: string;
  label: string;
  spend: number | null;
  hasCampaignRows: boolean;
};

type PasteFile = {
  facebook?: Record<string, PeriodSpendPaste>;
  google?: Record<string, PeriodSpendPaste>;
};

function periodKey(period: DashboardPeriod) {
  return `${period.startDate}_${period.endDate}`;
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

async function readPasteFile(): Promise<PasteFile> {
  return (await readDurableJson<PasteFile>("ads-paste")) ?? {};
}

async function writePasteFile(data: PasteFile) {
  await writeDurableJson("ads-paste", data);
}

export function parseSpendPaste(input: {
  spend: unknown;
  purchases: unknown;
  revenue: unknown;
}): SpendPaste | null {
  const spend = parseAmount(input.spend);
  const purchases = parseAmount(input.purchases);
  const revenue = parseAmount(input.revenue);

  if (spend === null && purchases === null && revenue === null) {
    return null;
  }

  return { spend, purchases, revenue };
}

function detectDelimiter(line: string) {
  const comma = (line.match(/,/g) || []).length;
  const tab = (line.match(/\t/g) || []).length;
  const semi = (line.match(/;/g) || []).length;
  if (tab > comma && tab >= semi) {
    return "\t";
  }
  if (semi > comma && semi > tab) {
    return ";";
  }
  return ",";
}

function splitCsvLine(line: string, delimiter = ",") {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function headerIndex(headers: string[], needles: string[]) {
  return headers.findIndex((header) =>
    needles.some((needle) => header === needle || header.includes(needle)),
  );
}

function isTotalLabel(value: string) {
  return value.replace(/"/g, "").trim().toLowerCase() === "total";
}

/** Totals from an Ads Manager CSV export for the selected date range. */
export function parseAdsManagerCsv(text: string): SpendPaste | null {
  const cleaned = text
    .replace(/^\uFEFF/, "")
    .replace(/\u0000/g, "");
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let headerAt = -1;
  let delimiter = ",";
  for (let i = 0; i < Math.min(lines.length, 40); i += 1) {
    const guessed = detectDelimiter(lines[i]);
    const normalized = splitCsvLine(lines[i], guessed).map(normalizeHeader);
    if (headerIndex(normalized, ["amount spent", "amount spend", "spend"]) >= 0) {
      headerAt = i;
      delimiter = guessed;
      break;
    }
  }

  if (headerAt < 0) {
    return null;
  }

  const headers = splitCsvLine(lines[headerAt], delimiter).map(normalizeHeader);
  const spendCol = headerIndex(headers, ["amount spent", "amount spend", "spend"]);
  const purchaseCol = headerIndex(headers, [
    "website purchases",
    "purchases",
  ]);
  const resultCol =
    purchaseCol >= 0 ? -1 : headerIndex(headers, ["results"]);
  const revenueCol = headerIndex(headers, [
    "website purchase conversion value",
    "purchases conversion value",
    "purchase conversion value",
    "conversion value",
  ]);
  const buyCol = purchaseCol >= 0 ? purchaseCol : resultCol;
  const campaignCol = headers.findIndex(
    (header) => header === "campaign name" || header === "campaign",
  );

  const dataRows = lines
    .slice(headerAt + 1)
    .map((line) => splitCsvLine(line, delimiter))
    .filter((cells) => cells.some((cell) => cell !== ""));
  const totalRow = dataRows.find((cells) => cells.some((cell) => isTotalLabel(cell)));
  const detailRows = dataRows.filter((cells) => !cells.some((cell) => isTotalLabel(cell)));
  const totalSource = totalRow ? [totalRow] : detailRows;

  if (totalSource.length === 0) {
    return null;
  }

  let spend = 0;
  let purchases = 0;
  let revenue = 0;

  for (const cells of totalSource) {
    spend += parseAmount(spendCol >= 0 ? cells[spendCol] : null) ?? 0;
    purchases += parseAmount(buyCol >= 0 ? cells[buyCol] : null) ?? 0;
    revenue += parseAmount(revenueCol >= 0 ? cells[revenueCol] : null) ?? 0;
  }

  const campaigns: CampaignSpendRow[] = [];
  if (campaignCol >= 0) {
    for (const cells of detailRows) {
      const campaign = (cells[campaignCol] || "").trim();
      if (!campaign || isTotalLabel(campaign)) {
        continue;
      }

      const rowSpend = parseAmount(spendCol >= 0 ? cells[spendCol] : null);
      if (rowSpend === null) {
        continue;
      }

      campaigns.push({
        campaign,
        spend: rowSpend,
        purchases: parseAmount(buyCol >= 0 ? cells[buyCol] : null),
        revenue: parseAmount(revenueCol >= 0 ? cells[revenueCol] : null),
      });
    }
  }

  return {
    spend: spendCol >= 0 ? spend : null,
    purchases: buyCol >= 0 ? purchases : null,
    revenue: revenueCol >= 0 ? revenue : null,
    campaigns: campaigns.length > 0 ? campaigns : undefined,
  };
}

export async function listSpendCoverage(): Promise<SpendCoverageRow[]> {
  const data = await readPasteFile();
  const rows: SpendCoverageRow[] = [];

  for (const [platform, bucket] of [
    ["facebook", data.facebook],
    ["google", data.google],
  ] as const) {
    for (const stored of Object.values(bucket || {})) {
      rows.push({
        platform,
        startDate: stored.startDate,
        endDate: stored.endDate,
        label: stored.label,
        spend: stored.spend,
        hasCampaignRows: (stored.campaigns || []).length > 0,
      });
    }
  }

  return rows.sort((a, b) =>
    b.endDate.localeCompare(a.endDate) || b.startDate.localeCompare(a.startDate),
  );
}

export async function getMetaPaste(
  period: DashboardPeriod,
): Promise<PeriodSpendPaste | null> {
  const stored = (await readPasteFile()).facebook?.[periodKey(period)];
  if (!stored) {
    return null;
  }

  if (stored.startDate !== period.startDate || stored.endDate !== period.endDate) {
    return null;
  }

  return stored;
}

export async function saveMetaPaste(
  period: DashboardPeriod,
  paste: SpendPaste,
) {
  const data = await readPasteFile();
  data.facebook = {
    ...data.facebook,
    [periodKey(period)]: {
      ...paste,
      startDate: period.startDate,
      endDate: period.endDate,
      label: period.label,
    },
  };
  await writePasteFile(data);
}

export async function clearMetaPaste(period: DashboardPeriod) {
  const data = await readPasteFile();
  if (!data.facebook) {
    return;
  }

  delete data.facebook[periodKey(period)];
  await writePasteFile(data);
}

export async function getGooglePaste(period: DashboardPeriod) {
  const stored = (await readPasteFile()).google?.[periodKey(period)];
  if (!stored) {
    return null;
  }

  if (stored.startDate !== period.startDate || stored.endDate !== period.endDate) {
    return null;
  }

  return stored;
}

export async function saveGooglePaste(period: DashboardPeriod, paste: SpendPaste) {
  const data = await readPasteFile();
  data.google = {
    ...data.google,
    [periodKey(period)]: {
      ...paste,
      startDate: period.startDate,
      endDate: period.endDate,
      label: period.label,
    },
  };
  await writePasteFile(data);
}

export function pasteToClaim(
  paste: SpendPaste,
  message: string,
  source: PlatformClaim["source"] = "facebook",
  label = source === "google" ? "Google Ads" : "Meta Ads",
): PlatformClaim {
  return {
    source,
    label,
    state: "connected",
    claimKind: "paste",
    spend: paste.spend,
    purchases: paste.purchases,
    revenue: paste.revenue,
    message,
  };
}
