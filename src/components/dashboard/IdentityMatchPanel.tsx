import { formatNumber, formatPercent } from "@/lib/format";
import { coverageRatio } from "@/lib/metrics/formulas";
import type { IdentityStats } from "@/lib/stape/attribution-types";

type IdentityMatchPanelProps = {
  identity: IdentityStats;
};

export function IdentityMatchPanel({ identity }: IdentityMatchPanelProps) {
  const personMatch = coverageRatio(
    identity.purchasesWithPerson,
    identity.purchases,
  );
  const crossDevice = coverageRatio(
    identity.crossDevicePeople,
    identity.uniquePeople,
  );
  const hasAny = identity.purchases > 0 || identity.uniquePeople > 0;

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">
        Identity match rates
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        How often a purchase can be stitched to a person_key (user_id or
        identity map), not Ads Manager matching. Cross-device is people with
        more than one client_id.
      </p>
      {!hasAny ? (
        <p className="mt-6 text-sm text-muted">
          Appears once Stape / BigQuery has purchase events for this range.
        </p>
      ) : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Purchases with person_key</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {personMatch === null ? "—" : formatPercent(personMatch)}
            </dd>
            <dd className="text-xs text-muted">
              {formatNumber(identity.purchasesWithPerson)} /{" "}
              {formatNumber(identity.purchases)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Unique people</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {formatNumber(identity.uniquePeople)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Unique browsers</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {formatNumber(identity.uniqueBrowsers)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Cross-device people</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {crossDevice === null ? "—" : formatPercent(crossDevice)}
            </dd>
            <dd className="text-xs text-muted">
              {formatNumber(identity.crossDevicePeople)} of{" "}
              {formatNumber(identity.uniquePeople)} people
            </dd>
          </div>
        </dl>
      )}
    </article>
  );
}
