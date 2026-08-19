import {
  attribute,
  creditByChannel,
  eligibleTouches,
  ATTRIBUTION_MODELS,
  ATTRIBUTION_MODEL_LABELS,
  assistCredits,
} from "@/lib/attribution/engine";
import { isDirectChannel, isPaidChannel } from "@/lib/attribution/channel";
import { identityEvidence } from "@/lib/attribution/identity";
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

function statusClass(status: string) {
  if (status === "STITCHED" || status === "CORROBORATED") {
    return "text-positive";
  }
  if (status === "PRESENT") {
    return "text-foreground";
  }
  if (status === "MISSING") {
    return "text-negative";
  }
  return "text-muted";
}

export function OrderAttributionDebugger({
  order,
  lookbackDays,
  currencyCode,
}: OrderAttributionDebuggerProps) {
  const touchpoints = orderToTouchpoints(order);
  const eligible = eligibleTouches(touchpoints, order.purchaseTs, lookbackDays);
  const excluded = touchpoints.filter(
    (touch) => !eligible.some((item) => item.id === touch.id),
  );
  const identity = identityEvidence({
    personKey: order.personKey,
    gnUid: order.gnUid,
    stapeUserId: order.stapeUserId,
    shopifyCustomerId: order.shopifyCustomerId,
    hashedEmailPresent: order.hashedEmailPresent,
    transactionId: order.transactionId,
    clientId: order.clientId,
  });
  const assists = assistCredits(touchpoints, order.purchaseTs, lookbackDays);
  const first = eligible[0];
  const last = eligible[eligible.length - 1];
  const lagDays =
    first && Number.isFinite(order.purchaseTs)
      ? Math.max(0, (order.purchaseTs - first.timestamp) / DAY_MS)
      : null;

  return (
    <div className="grid gap-5 border-t border-border pt-5 lg:grid-cols-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Journey · {lookbackDays}-day lookback
        </h3>
        <p className="mt-1 text-xs text-muted">
          First {first?.channel ?? "—"} · Last {last?.channel ?? "—"} · Last non-direct{" "}
          {order.lastNonDirect} · {eligible.length} eligible ·{" "}
          {eligible.filter((touch) => touch.isPaid).length} paid · lag{" "}
          {lagDays == null ? "—" : `${lagDays.toFixed(1)}d`}
        </p>
        {eligible.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No first-party touches were stitched to this order within the
            lookback. It stays Unattributed/Unknown — not Direct.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {eligible.map((touch, index) => {
              const previous = index > 0 ? eligible[index - 1] : null;
              const gapDays = previous
                ? (touch.timestamp - previous.timestamp) / DAY_MS
                : null;
              const original = order.touches.find(
                (item) =>
                  (item.touchpointId || item.sessionKey) === touch.id,
              );
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
                      {original?.campaign ? ` · ${original.campaign}` : ""}
                      {original?.landingPage ? ` · ${original.landingPage}` : ""}
                      {original?.fbclid ? " · fbclid" : ""}
                      {original?.gclid ? " · gclid" : ""}
                    </p>
                  </div>
                </li>
              );
            })}
            <li className="flex gap-3 text-sm">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">
                  Purchase ·{" "}
                  {order.moneySource === "shopify"
                    ? formatMoney({ amount: order.revenue, currencyCode })
                    : "Shopify unmatched"}
                </p>
                <p className="text-xs text-muted">
                  {dateTime(order.purchaseTs)}
                  {order.eventPurchaseValue != null
                    ? ` · event value ${formatMoney({ amount: order.eventPurchaseValue, currencyCode })} (QA only)`
                    : ""}
                  {order.isNewCustomer === true ? " · new customer" : ""}
                  {order.isNewCustomer === false ? " · returning" : ""}
                </p>
              </div>
            </li>
          </ol>
        )}
        {excluded.length > 0 ? (
          <p className="mt-3 text-xs text-muted">
            Excluded {excluded.length} touch{excluded.length === 1 ? "" : "es"}{" "}
            (outside window or after purchase).
          </p>
        ) : null}

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Identity evidence · {identity.confidence}
        </h3>
        <p className="mt-1 text-xs text-muted">{identity.summary}</p>
        <ul className="mt-2 space-y-1 text-xs">
          {identity.fields.map((field) => (
            <li key={field.key} className="flex justify-between gap-3">
              <span className="text-foreground">{field.label}</span>
              <span className={statusClass(field.status)}>
                {field.status}
                {field.display ? ` · ${field.display}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-muted">
          Transaction <span className="font-mono">{order.transactionId}</span>.
          Hashed email is presence-only. No plaintext PII.
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
                  <p className="mt-1 text-xs text-muted">
                    Unattributed under this model (not Direct).
                  </p>
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
                            amount: (order.shopifyNetRevenue ?? 0) * weight,
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
          <div className="rounded-xl border border-border bg-elevated/60 p-3">
            <p className="text-sm font-medium text-foreground">Assists (middle touches)</p>
            {assists.length === 0 ? (
              <p className="mt-1 text-xs text-muted">
                No middle touches (need 3+ eligible touches). Not Linear.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {Object.entries(creditByChannel(assists)).map(([channel, weight]) => (
                  <li key={channel} className="flex justify-between gap-3 text-xs">
                    <span className="text-foreground">{channel}</span>
                    <span className="text-muted">{formatPercent(weight)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
