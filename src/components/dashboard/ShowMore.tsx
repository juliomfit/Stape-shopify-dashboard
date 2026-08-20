"use client";

import { useMemo, useState } from "react";

export const DASHBOARD_TABLE_PAGE_SIZE = 75;

export function useShowMore<T>(items: T[], initial = DASHBOARD_TABLE_PAGE_SIZE) {
  const [shown, setShown] = useState(initial);
  const visible = useMemo(() => items.slice(0, shown), [items, shown]);
  return {
    visible,
    shown: Math.min(shown, items.length),
    total: items.length,
    hasMore: items.length > shown,
    remaining: Math.max(items.length - shown, 0),
    showMore: () => setShown((count) => count + initial),
  };
}

export function ShowMoreButton({
  remaining,
  onMore,
}: {
  remaining: number;
  onMore: () => void;
}) {
  if (remaining <= 0) return null;
  return (
    <div className="border-t border-border px-6 py-3">
      <button
        type="button"
        onClick={onMore}
        className="text-sm font-medium text-accent hover:underline"
      >
        Show more ({remaining} remaining)
      </button>
    </div>
  );
}
