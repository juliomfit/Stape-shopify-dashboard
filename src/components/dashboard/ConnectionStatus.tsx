import type { ShopifyConnectionStatus } from "@/lib/shopify/types";

type ConnectionStatusProps = {
  status: ShopifyConnectionStatus;
};

export function ConnectionStatus({ status }: ConnectionStatusProps) {
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
        Shopify error · {status.message}
      </p>
    );
  }

  return (
    <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      Shopify not connected yet
    </p>
  );
}
