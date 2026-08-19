import {
  FLYWEEL_CAMPAIGN_ONLY_WARNING,
  flyweelCampaignOnlyWarning,
} from "@/lib/ads/providers/config";
import type { MetaFactTableCounts } from "@/lib/ads/meta-fact-format";

type MetaIngestHealthPanelProps = {
  providerId: string;
  counts: MetaFactTableCounts;
};

function countLabel(value: number | null, available: boolean) {
  if (!available || value == null) return "—";
  return String(value);
}

export function MetaIngestHealthPanel({
  providerId,
  counts,
}: MetaIngestHealthPanelProps) {
  const warning = flyweelCampaignOnlyWarning(providerId);
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Meta fact ingest</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Warehouse row counts from goodsnova_platform. 0 means the table was
        read and is empty. — means the count is unavailable. These are not
        attributed orders.
      </p>
      {warning ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {FLYWEEL_CAMPAIGN_ONLY_WARNING}
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-border text-sm">
        <li className="flex justify-between gap-4 py-2.5">
          <span>meta_campaign_insights_daily</span>
          <span className="text-muted">{countLabel(counts.campaigns, counts.available)}</span>
        </li>
        <li className="flex justify-between gap-4 py-2.5">
          <span>meta_adset_insights_daily</span>
          <span className="text-muted">{countLabel(counts.adsets, counts.available)}</span>
        </li>
        <li className="flex justify-between gap-4 py-2.5">
          <span>meta_ad_insights_daily</span>
          <span className="text-muted">{countLabel(counts.ads, counts.available)}</span>
        </li>
      </ul>
    </article>
  );
}
