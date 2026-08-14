"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SALES_JOURNEY_FILTERS } from "@/lib/shopify/journey";

type SalesJourneyFilterProps = {
  filter: string;
};

export function SalesJourneyFilter({ filter }: SalesJourneyFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="flex w-full flex-col gap-1 text-xs text-muted md:max-w-sm">
      Journey filter
      <select
        className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground md:text-sm"
        value={filter}
        onChange={(event) => {
          const next = new URLSearchParams(searchParams.toString());
          if (event.target.value) {
            next.set("filter", event.target.value);
          } else {
            next.delete("filter");
          }
          const query = next.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }}
      >
        {SALES_JOURNEY_FILTERS.map((item) => (
          <option key={item.key || "all"} value={item.key}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
