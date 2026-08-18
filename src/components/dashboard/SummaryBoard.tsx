"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { MetricTile, type SummaryMetric } from "@/components/dashboard/MetricTile";

const PIN_STORAGE_KEY = "summary_pinned_metrics";

const pinListeners = new Set<() => void>();
const EMPTY_PINS: string[] = [];
let pinsCache: string[] = EMPTY_PINS;
let pinsLoaded = false;

function loadPins(): string[] {
  if (!pinsLoaded) {
    try {
      const raw = localStorage.getItem(PIN_STORAGE_KEY);
      pinsCache = raw ? (JSON.parse(raw) as string[]) : EMPTY_PINS;
    } catch {
      pinsCache = EMPTY_PINS;
    }
    pinsLoaded = true;
  }
  return pinsCache;
}

function subscribePins(callback: () => void) {
  pinListeners.add(callback);
  return () => {
    pinListeners.delete(callback);
  };
}

function getServerPins(): string[] {
  return EMPTY_PINS;
}

function writePins(next: string[]) {
  pinsCache = next;
  pinsLoaded = true;
  try {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }
  pinListeners.forEach((listener) => listener());
}

type SummaryBoardProps = {
  metrics: SummaryMetric[];
};

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-sm text-foreground"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-accent" : "border border-border bg-elevated"
        }`}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full shadow transition-all"
          style={{ left: checked ? "18px" : "2px", backgroundColor: "#ffffff" }}
        />
      </span>
      {label}
    </button>
  );
}

export function SummaryBoard({ metrics }: SummaryBoardProps) {
  const [compare, setCompare] = useState(true);
  const pinned = useSyncExternalStore(subscribePins, loadPins, getServerPins);

  function togglePin(id: string) {
    const next = pinned.includes(id)
      ? pinned.filter((value) => value !== id)
      : [...pinned, id];
    writePins(next);
  }

  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, SummaryMetric[]>();
    for (const metric of metrics) {
      if (!byGroup.has(metric.group)) {
        byGroup.set(metric.group, []);
        order.push(metric.group);
      }
      byGroup.get(metric.group)!.push(metric);
    }
    return order.map((label) => ({ label, items: byGroup.get(label)! }));
  }, [metrics]);

  const pinnedMetrics = useMemo(
    () =>
      pinned
        .map((id) => metrics.find((metric) => metric.id === id))
        .filter((metric): metric is SummaryMetric => Boolean(metric)),
    [pinned, metrics],
  );

  const pinnedSet = new Set(pinned);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-3.5 shadow-sm">
        <p className="text-xs leading-5 text-muted">
          Pin the KPIs you watch most (hover a tile and click the pin). Pins are
          saved on this device.
        </p>
        <Toggle
          checked={compare}
          onChange={setCompare}
          label="Compare to previous period"
        />
      </div>

      {pinnedMetrics.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            Pinned KPIs
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {pinnedMetrics.map((metric) => (
              <MetricTile
                key={`pin-${metric.id}`}
                metric={metric}
                showDelta={compare}
                pinned
                onTogglePin={togglePin}
              />
            ))}
          </div>
        </section>
      ) : null}

      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            {group.label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {group.items.map((metric) => (
              <MetricTile
                key={metric.id}
                metric={metric}
                showDelta={compare}
                pinned={pinnedSet.has(metric.id)}
                onTogglePin={togglePin}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
