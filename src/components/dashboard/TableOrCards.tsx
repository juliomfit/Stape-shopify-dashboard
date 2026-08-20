import type { ReactNode } from "react";
import Link from "next/link";

export function TableOrCards({
  table,
  cards,
}: {
  table: ReactNode;
  cards: ReactNode;
}) {
  return (
    <>
      <div className="md:hidden">{cards}</div>
      <div className="hidden overflow-x-auto md:block">{table}</div>
    </>
  );
}

export function StackList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border">{children}</div>;
}

export function StackRow({
  href,
  children,
}: {
  href?: string;
  children: ReactNode;
}) {
  const className =
    "flex flex-col gap-1.5 px-4 py-3.5 active:bg-slate-50 md:px-6";
  if (href) {
    return (
      <Link prefetch={false} href={href} className={className}>
        {children}
      </Link>
    );
  }
  return <div className={className}>{children}</div>;
}
