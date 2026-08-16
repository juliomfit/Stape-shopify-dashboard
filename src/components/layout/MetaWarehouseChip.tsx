import Link from "next/link";
import { getCampaignFacts, totalsFromFacts } from "@/lib/ads/meta-query";
import { formatMoney } from "@/lib/format";
import { getDashboardPeriod } from "@/lib/period";
import { latestSuccessfulSync } from "@/lib/platform/sync-runs";

export async function MetaWarehouseChip() {
  const [lastSync, todayFacts, yesterdayFacts] = await Promise.all([
    latestSuccessfulSync("meta").catch(() => null),
    getCampaignFacts(getDashboardPeriod("today")).catch(() => []),
    getCampaignFacts(getDashboardPeriod("yesterday")).catch(() => []),
  ]);
  const today = totalsFromFacts(todayFacts);
  const yesterday = totalsFromFacts(yesterdayFacts);
  const syncLabel = lastSync?.completed_at
    ? lastSync.completed_at.replace("T", " ").slice(0, 16)
    : "no sync yet";
  const todayLabel =
    todayFacts.length === 0 && yesterday.spend > 0
      ? "Today $0 (Flyweel lag)"
      : today.spend > 0
        ? `Today ${formatMoney({ amount: today.spend, currencyCode: "USD" })}`
        : "Today —";

  return (
    <p className="text-[11px] leading-4 text-muted">
      <Link href="/meta" className="text-accent hover:underline">
        Meta warehouse
      </Link>
      {` · ${syncLabel} PT · ${todayLabel} · Yesterday ${
        yesterdayFacts.length
          ? formatMoney({ amount: yesterday.spend, currencyCode: "USD" })
          : "—"
      }`}
    </p>
  );
}
