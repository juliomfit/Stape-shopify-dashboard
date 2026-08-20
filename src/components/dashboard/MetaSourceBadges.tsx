import type { CampaignMappingConfidence } from "@/lib/attribution/campaign-map";

export function MappingBadge({
  label,
  confidence,
}: {
  label: string;
  confidence: CampaignMappingConfidence;
}) {
  const tone =
    confidence === "HIGH"
      ? "bg-emerald-50 text-emerald-800"
      : confidence === "PARTIAL"
        ? "bg-amber-50 text-amber-900"
        : "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {label}
      <span className="font-mono text-[10px] opacity-70">{confidence}</span>
    </span>
  );
}

export function FirstPartyIdBadge() {
  return (
    <span
      className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
      title="Captured from GoodsNova session/UTM tracking. Flyweel does not independently provide ad-set platform facts."
    >
      First-party ID
    </span>
  );
}

export function FirstPartySourceLabel({
  extra = "Platform spend unavailable at this grain from Flyweel.",
}: {
  extra?: string;
}) {
  return (
    <p className="text-[11px] leading-4 text-muted">
      GoodsNova first-party attribution
      {extra ? ` · ${extra}` : ""}
    </p>
  );
}
