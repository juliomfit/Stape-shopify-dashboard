import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, CircleOff, Database, ShoppingBag } from "lucide-react";
import { ChannelMark } from "@/components/dashboard/ChannelMark";
import type { ShopifyConnectionStatus } from "@/lib/shopify/types";
import type { StapeConnectionStatus } from "@/lib/stape/types";
import type { PlatformClaim } from "@/lib/ads/types";

type ConnectionStatusProps = {
  shopify: ShopifyConnectionStatus;
  stape?: StapeConnectionStatus;
  facebook?: PlatformClaim;
  google?: PlatformClaim;
};

function pill(
  kind: "ok" | "err" | "off",
  icon: ReactNode,
  children: string,
) {
  const cls =
    kind === "ok"
      ? "bg-emerald-50 text-emerald-800"
      : kind === "err"
        ? "bg-red-50 text-red-700"
        : "bg-slate-100 text-slate-600";
  const status =
    kind === "ok" ? (
      <CircleCheck className="h-3 w-3 shrink-0" />
    ) : kind === "err" ? (
      <CircleAlert className="h-3 w-3 shrink-0" />
    ) : (
      <CircleOff className="h-3 w-3 shrink-0" />
    );
  return (
    <p
      className={`inline-flex max-w-xl items-center gap-1.5 truncate rounded-md px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {icon}
      {status}
      {children}
    </p>
  );
}

function AdsPill({ claim }: { claim: PlatformClaim }) {
  const mark = <ChannelMark name={claim.label} size={14} />;
  if (claim.state === "connected") {
    return pill("ok", mark, `${claim.label} connected`);
  }
  if (claim.state === "error") {
    const message = claim.message ?? "error";
    return pill(
      "err",
      mark,
      `${claim.label} error · ${message.length > 120 ? `${message.slice(0, 120)}…` : message}`,
    );
  }
  return pill("off", mark, `${claim.label} off`);
}

function ShopifyPill({ status }: { status: ShopifyConnectionStatus }) {
  const icon = <ShoppingBag className="h-3.5 w-3.5 shrink-0" />;
  if (status.state === "connected") {
    return pill("ok", icon, `Shopify · ${status.shopName}`);
  }
  if (status.state === "error") {
    const message =
      status.message.length > 140
        ? `${status.message.slice(0, 140)}…`
        : status.message;
    return pill("err", icon, `Shopify · ${message}`);
  }
  return pill("off", icon, "Shopify off");
}

function StapePill({ status }: { status: StapeConnectionStatus }) {
  const icon = <Database className="h-3.5 w-3.5 shrink-0" />;
  if (status.state === "connected") {
    return pill("ok", icon, "Stape · BigQuery");
  }
  if (status.state === "error") {
    const message =
      status.message.length > 140
        ? `${status.message.slice(0, 140)}…`
        : status.message;
    return pill("err", icon, `Stape · ${message}`);
  }
  return pill("off", icon, "Stape off");
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
