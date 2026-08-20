export default function DashboardLoading() {
  return (
    <div className="dash-page gap-6 p-4 lg:p-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--border)]" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-[var(--border)]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
    </div>
  );
}
