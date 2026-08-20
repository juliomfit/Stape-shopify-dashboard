"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * Dashboard nav/table link: no viewport prefetch and no hover prefetch.
 * Intelligent prefetch can be restored later; it must not storm RSC routes.
 */
export function NavPrefetchLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false} />;
}

/** Row/table links: client navigation without viewport prefetch. */
export function DashboardLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false} />;
}
