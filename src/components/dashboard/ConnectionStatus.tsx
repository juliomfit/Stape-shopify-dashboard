import type { ShopifyConnectionStatus } from "@/lib/shopify/types";
import type { StapeConnectionStatus } from "@/lib/stape/types";
import type { PlatformClaim } from "@/lib/ads/types";

type ConnectionStatusProps = {
  shopify: ShopifyConnectionStatus;
  stape?: StapeConnectionStatus;
  facebook?: PlatformClaim;
  google?: PlatformClaim;
};

function pill(kind: "ok" | "err" | "off", children: string) {
  const cls =
    kind === "ok"
      ? "bg-emerald-50 text-emerald-800"
      : kind === "err"
        ? "bg-red-50 text-red-700"
        : "bg-slate-100 text-slate-600";
  return (
    <p className={`max-w-xl truncate rounded-md px-2.5 py-1 text-xs font-medium ${cls}`}>
      {children}
    </p>
  );
}

function AdsPill({ claim }: { claim: PlatformClaim }) {
  if (claim.state === "connected") {
    return pill("ok", `${claim.label} connected`);
  }
  if (claim.state === "error") {
    const message = claim.message ?? "error";
    return pill(
      "err",
      `${claim.label} error · ${message.length > 120 ? `${message.slice(0, 120)}…` : message}`,
    );
  }
  return pill("off", `${claim.label} off`);
}

function ShopifyPill({ status }: { status: ShopifyConnectionStatus }) {
  if (status.state === "connected") {
    return pill("ok", `Shopify · ${status.shopName}`);
  }
  if (status.state === "error") {
    const message =
      status.message.length > 140
        ? `${status.message.slice(0, 140)}…`
        : status.message;
    return pill("err", `Shopify · ${message}`);
  }
  return pill("off", "Shopify off");
}

function StapePill({ status }: { status: StapeConnectionStatus }) {
  if (status.state === "connected") {
    return pill("ok", "Stape · BigQuery");
  }
  if (status.state === "error") {
    const message =
      status.message.length > 140
        ? `${status.message.slice(0, 140)}…`
        : status.message;
    return pill("err", `Stape · ${message}`);
  }
  return pill("off", "Stape off");
}

export function ConnectionStatus({
  shopify,
  stape,
  facebook,
  google,
}: ConnectionStatusProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ShopifyPill status={shopify} />
      {stape ? <StapePill status={stape} /> : null}
      {facebook ? <AdsPill claim={facebook} /> : null}
      {google ? <AdsPill claim={google} /> : null}
    </div>
  );
}
