import { formatPercent } from "@/lib/format";
import type { MetaFirstPartyIdCoverage } from "@/lib/attribution/observed-meta-grain";

export function MetaIdCoveragePanel({ coverage }: { coverage: MetaFirstPartyIdCoverage }) {
  const pct = (rate: number | null) => (rate == null ? "—" : formatPercent(rate));
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-5">
      <h2 className="text-sm font-semibold text-foreground">Meta ID coverage</h2>
      <p className="mt-1 text-[11px] leading-4 text-muted">
        Denominator: Meta paid canonical touches ({coverage.metaPaidTouches}). Capture rates, not Flyweel verification.
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Campaign ID</dt>
          <dd className="mt-1 font-semibold text-foreground">{pct(coverage.campaignIdRate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Ad Set ID</dt>
          <dd className="mt-1 font-semibold text-foreground">{pct(coverage.adsetIdRate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Ad ID</dt>
          <dd className="mt-1 font-semibold text-foreground">{pct(coverage.adIdRate)}</dd>
        </div>
      </dl>
    </article>
  );
}
