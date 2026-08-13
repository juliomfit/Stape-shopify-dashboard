import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { PlatformClaim } from "@/lib/ads/types";
import type { DashboardPeriod } from "@/lib/period";

const PASTE_FILE = path.join(process.cwd(), "secrets/ads-paste.json");

export type SpendPaste = {
  spend: number | null;
  purchases: number | null;
  revenue: number | null;
};

export type PeriodSpendPaste = SpendPaste & {
  startDate: string;
  endDate: string;
  label: string;
};

type PasteFile = {
  facebook?: Record<string, PeriodSpendPaste>;
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
  try {
    return JSON.parse(await readFile(PASTE_FILE, "utf8")) as PasteFile;
  } catch {
    return {};
  }
}

async function writePasteFile(data: PasteFile) {
  await mkdir(path.dirname(PASTE_FILE), { recursive: true });
  await writeFile(PASTE_FILE, `${JSON.stringify(data, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
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

export function pasteToClaim(
  paste: SpendPaste,
  message: string,
): PlatformClaim {
  return {
    source: "facebook",
    label: "Meta Ads",
    state: "connected",
    spend: paste.spend,
    purchases: paste.purchases,
    revenue: paste.revenue,
    message,
  };
}
