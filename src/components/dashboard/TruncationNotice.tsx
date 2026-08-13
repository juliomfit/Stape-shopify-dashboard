import { formatNumber } from "@/lib/format";

type TruncationNoticeProps = {
  truncated: boolean;
  fetched: number;
  reportedCount?: number | null;
  noun?: string;
};

export function TruncationNotice({
  truncated,
  fetched,
  reportedCount = null,
  noun = "orders",
}: TruncationNoticeProps) {
  if (!truncated) {
    return null;
  }

  const ofTotal =
    reportedCount !== null && reportedCount > fetched
      ? ` of ${formatNumber(reportedCount)}`
      : "";

  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
      Showing the first {formatNumber(fetched)} {noun}
      {ofTotal}. Narrow the date range so totals, charts, and tables include
      every {noun.replace(/s$/, "")} in the period.
    </p>
  );
}
