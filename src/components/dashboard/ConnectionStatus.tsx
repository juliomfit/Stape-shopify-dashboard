import type { ShopifyConnectionStatus } from "@/lib/shopify/types";
import type { StapeConnectionStatus } from "@/lib/stape/types";

type ConnectionStatusProps = {
  shopify: ShopifyConnectionStatus;
  stape?: StapeConnectionStatus;
};

function ShopifyPill({ status }: { status: ShopifyConnectionStatus }) {
  if (status.state === "connected") {
    return (
      <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        Shopify connected · {status.shopName}
      </p>
    );
  }

  if (status.state === "error") {
    return (
      <p className="max-w-xl rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
        Shopify error · {status.message.length > 140
          ? `${status.message.slice(0, 140)}…`
          : status.message}
      </p>
    );
  }

  return (
    <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      Shopify not connected yet
    </p>
  );
}

function StapePill({ status }: { status: StapeConnectionStatus }) {
  if (status.state === "connected") {
    return (
      <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        Stape / BigQuery connected · {status.projectId}
      </p>
    );
  }

  if (status.state === "error") {
    return (
      <p className="max-w-xl rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
        Stape error · {status.message}
      </p>
    );
  }

  return (
    <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      Stape not connected yet
    </p>
  );
}

export function ConnectionStatus({ shopify, stape }: ConnectionStatusProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <ShopifyPill status={shopify} />
      {stape ? <StapePill status={stape} /> : null}
    </div>
  );
}
