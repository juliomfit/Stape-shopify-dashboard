import type { SourceHealth } from "@/lib/platform/health";

function tone(status: SourceHealth["status"]) {
  switch (status) {
    case "healthy":
      return "bg-emerald-50 text-emerald-800";
    case "syncing":
      return "bg-sky-50 text-sky-800";
    case "delayed":
    case "partial":
      return "bg-amber-50 text-amber-800";
    case "error":
      return "bg-red-50 text-red-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function DataHealthStrip({ sources }: { sources: SourceHealth[] }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Data health</h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {sources.map((source) => (
          <li key={source.source}>
            <a
              href={source.href}
              className={`flex flex-col rounded-xl px-3 py-2 ${tone(source.status)}`}
            >
              <span className="text-sm font-medium">
                {source.label} · {source.status}
                {source.provider && source.provider !== "none" ? ` · ${source.provider}` : ""}
              </span>
              <span className="text-xs opacity-80">{source.message}</span>
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
