"use client";

import Link from "next/link";
import { RangeHintButton } from "@/components/dashboard/RangeHintButton";

export type EmptyNext =
  | { kind: "href"; href: string; label: string }
  | { kind: "range"; range: "7d" | "yesterday"; label: string };

export function EmptyTable({
  title,
  why,
  next = [],
}: {
  title: string;
  why: string;
  next?: EmptyNext[];
}) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted">{why}</p>
      {next.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {next.map((item) =>
            item.kind === "href" ? (
              <Link prefetch={false}
                key={item.href + item.label}
                href={item.href}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent-soft"
              >
                {item.label}
              </Link>
            ) : (
              <RangeHintButton
                key={item.range + item.label}
                range={item.range}
                label={item.label}
              />
            ),
          )}
        </div>
      ) : null}
    </article>
  );
}
