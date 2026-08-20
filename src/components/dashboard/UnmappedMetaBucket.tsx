import { formatMoney } from "@/lib/format";
import { UNMAPPED_META_LABEL } from "@/lib/attribution/meta-credit";
import Link from "next/link";

export type UnmappedMetaBucketProps = {
  currencyCode: string;
  channelRevenue: number;
  campaignMappedRevenue: number;
  adsetMappedRevenue: number;
  adMappedRevenue: number;
};

export function UnmappedMetaBucket({
  currencyCode,
  channelRevenue,
  campaignMappedRevenue,
  adsetMappedRevenue,
  adMappedRevenue,
}: UnmappedMetaBucketProps) {
  const campaignUnmapped = channelRevenue - campaignMappedRevenue;
  const adsetUnmapped = channelRevenue - adsetMappedRevenue;
  const adUnmapped = channelRevenue - adMappedRevenue;
  const money = (amount: number) => formatMoney({ amount, currencyCode });

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">{UNMAPPED_META_LABEL}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Unmapped Meta credit is not missing money. Child tables only show the
        mapped slice. Equality to the parent holds only when mapping coverage is
        100%.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex justify-between gap-4">
          <span>Meta channel OUR revenue</span>
          <span>{money(channelRevenue)}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Campaign-mapped</span>
          <span>{money(campaignMappedRevenue)}</span>
        </li>
        <li className="flex justify-between gap-4">
          <Link prefetch={false} className="underline" href="/meta/our/unmapped/_">
            Unmapped to campaign
          </Link>
          <span>{money(campaignUnmapped)}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Ad-set-mapped</span>
          <span>{money(adsetMappedRevenue)}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Unmapped to ad set</span>
          <span>{money(adsetUnmapped)}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Ad-mapped</span>
          <span>{money(adMappedRevenue)}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Unmapped to ad</span>
          <span>{money(adUnmapped)}</span>
        </li>
      </ul>
    </article>
  );
}
