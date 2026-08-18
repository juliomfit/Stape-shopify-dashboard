import {
  attribute,
  creditByChannel,
  eligibleTouches,
  ATTRIBUTION_MODELS,
  ATTRIBUTION_MODEL_LABELS,
} from "@/lib/attribution/engine";
import { isDirectChannel, isPaidChannel } from "@/lib/attribution/channel";
import { orderToTouchpoints } from "@/lib/attribution/journey";
import type { AttributedOrder } from "@/lib/stape/attribution-types";
import { DASHBOARD_TZ } from "@/lib/period";
import { formatMoney, formatPercent } from "@/lib/format";

type OrderAttributionDebuggerProps = {
  order: AttributedOrder;
  lookbackDays: number;
  currencyCode: string;
};

function dateTime(ts: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DASHBOARD_TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

function touchDotClass(channel: string) {
  if (isDirectChannel(channel)) {
    return "bg-muted";
  }
  if (isPaidChannel(channel)) {
    return "bg-accent";
  }
  return "bg-positive";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function OrderAttributionDebugger({
  order,
  lookbackDays,
  currencyCode,
}: OrderAttributionDebuggerProps) {
  const touchpoints = orderToTouchpoints(order);
  const eligible = eligibleTouches(touchpoints, order.purchaseTs, lookbackDays);

  return (
    <div className="grid gap-5 border-t border-border pt-5 lg:grid-cols-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Journey · {lookbackDays}-day lookback
        </h3>
        {eligible.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No first-party touches were stitched to this order within the
            lookback. It is credited as Direct/Unknown.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {eligible.map((touch, index) => {
              const previous = index > 0 ? eligible[index - 1] : null;
              const gapDays = previous
                ? (touch.timestamp - previous.timestamp) / DAY_MS
                : null;
              return (
                <li key={touch.id} className="flex gap-3 text-sm">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${touchDotClass(touch.channel)}`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-foreground">{touch.channel}</p>
                    <p className="text-xs text-muted">
                      {dateTime(touch.timestamp)}
                      {gapDays !== null
                        ? ` · ${gapDays < 1 ? "same day" : `${gapDays.toFixed(1)}d later`}`
                        : " · first touch"}
                    </p>
                  </div>
                </li>
              );
            })}
            <li className="flex gap-3 text-sm">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">
                  Purchase · {formatMoney({ amount: order.revenue, currencyCode })}
                </p>
                <p className="text-xs text-muted">{dateTime(order.purchaseTs)}</p>
              </div>
            </li>
          </ol>
        )}
        <p className="mt-4 text-xs leading-5 text-muted">
          Stitched on person key{" "}
          <span className="font-mono">{order.personKey || "—"}</span> (first-party
          identity from client_id / Data Client user_id). Transaction{" "}
          <span className="font-mono">{order.transactionId}</span>.
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Credit by attribution model
        </h3>
        <div className="mt-3 space-y-3">
          {ATTRIBUTION_MODELS.map((model) => {
            const credits = attribute(touchpoints, {
              model,
              purchaseTs: order.purchaseTs,
              windowDays: lookbackDays,
            });
            const byChannel = Object.entries(creditByChannel(credits)).sort(
              (a, b) => b[1] - a[1],
            );
            return (
              <div key={model} className="rounded-xl border border-border bg-elevated/60 p-3">
                <p className="text-sm font-medium text-foreground">
                  {ATTRIBUTION_MODEL_LABELS[model]}
                </p>
                {byChannel.length === 0 ? (
                  <p className="mt-1 text-xs text-muted">No eligible touch.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {byChannel.map(([channel, weight]) => (
                      <li
                        key={channel}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="text-foreground">{channel}</span>
                        <span className="text-muted">
                          {formatPercent(weight)} ·{" "}
                          {formatMoney({
                            amount: order.revenue * weight,
                            currencyCode,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
