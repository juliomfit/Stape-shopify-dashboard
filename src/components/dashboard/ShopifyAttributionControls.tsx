"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  SHOPIFY_ATTRIBUTION_MODELS,
  type ShopifyAttributionModel,
} from "@/lib/shopify/shopifyql";

type ShopifyAttributionControlsProps = {
  model: ShopifyAttributionModel;
};

export function ShopifyAttributionControls({
  model,
}: ShopifyAttributionControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Shopify Attribution model
        <select
          className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground md:min-h-0 md:text-sm"
          value={model}
          onChange={(event) => {
            const next = new URLSearchParams(searchParams.toString());
            next.set("model", event.target.value);
            router.replace(`${pathname}?${next.toString()}`);
          }}
        >
          {SHOPIFY_ATTRIBUTION_MODELS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {model === "any_click" ? (
        <p className="max-w-xl text-xs leading-5 text-amber-800">
          Any click gives full credit to every touch. Attributed sales can exceed
          actual Shopify totals. Do not use this as a source of truth.
        </p>
      ) : null}
    </div>
  );
}
