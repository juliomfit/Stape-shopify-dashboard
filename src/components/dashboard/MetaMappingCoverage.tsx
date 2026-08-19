import { formatMappingCoverageLabel, type MappingCoverageStatus } from "@/lib/attribution/meta-ids";
import { formatPercent } from "@/lib/format";

export type MetaMappingCoverageProps = {
  status: MappingCoverageStatus;
  channelHealthy: boolean;
  campaignHighId: number | null;
  campaignLegacyName: number | null;
  campaignUnmapped: number | null;
  adsetMapped: number | null;
  adMapped: number | null;
  metaTouches: number;
};

export function MetaMappingCoverage({
  status,
  channelHealthy,
  campaignHighId,
  campaignLegacyName,
  campaignUnmapped,
  adsetMapped,
  adMapped,
  metaTouches,
}: MetaMappingCoverageProps) {
  const showRates = status === "HAS_HIGH_ID_MAPS" && metaTouches > 0;
  const rate = (count: number | null) => {
    if (!showRates || count == null || metaTouches <= 0) return null;
    return formatPercent(count / metaTouches);
  };

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">Meta attribution mapping</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Channel attribution can be healthy while campaign/adset/ad IDs are still
        missing. Exact first-party IDs are HIGH. Campaign-name match is legacy
        PARTIAL only. Percentages appear only after at least one HIGH-ID map
        exists — not invented from current unmapped history.
      </p>
      <p className="mt-3 text-sm font-medium text-foreground">
        Status: {formatMappingCoverageLabel(status)}
      </p>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>Channel: {channelHealthy ? "healthy (Meta credit present)" : "no Meta credit in this range"}</li>
        <li>
          Campaign:{" "}
          {showRates
            ? `${rate(campaignHighId)} HIGH-ID · ${rate(campaignLegacyName)} legacy name · ${rate(campaignUnmapped)} unmapped`
            : formatMappingCoverageLabel(status)}
        </li>
        <li>
          Ad set:{" "}
          {showRates ? rate(adsetMapped) ?? "—" : "hidden until deterministic IDs exist"}
        </li>
        <li>
          Ad: {showRates ? rate(adMapped) ?? "—" : "hidden until deterministic IDs exist"}
        </li>
      </ul>
    </article>
  );
}
