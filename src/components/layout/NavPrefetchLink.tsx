"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type ComponentProps } from "react";

const HOVER_PREFETCH_MS = 150;

function canHoverPrefetch() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

/**
 * Dashboard nav link: no viewport prefetch. Desktop hover/focus may prefetch
 * one route after a short intent delay. Never warms the whole sidebar.
 */
export function NavPrefetchLink({
  href,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...props
}: ComponentProps<typeof Link>) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancel() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function schedule() {
    if (!canHoverPrefetch()) return;
    cancel();
    timer.current = setTimeout(() => {
      router.prefetch(String(href));
    }, HOVER_PREFETCH_MS);
  }

  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        schedule();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        schedule();
      }}
      onMouseLeave={(event) => {
        onMouseLeave?.(event);
        cancel();
      }}
      onBlur={(event) => {
        onBlur?.(event);
        cancel();
      }}
    />
  );
}

/** Row/table links: client navigation without viewport prefetch. */
export function DashboardLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false} />;
}
