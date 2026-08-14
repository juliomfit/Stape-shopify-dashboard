"use client";

type ExportCsvButtonProps = {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  label: string;
};

function csvCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function ExportCsvButton({
  filename,
  headers,
  rows,
  label,
}: ExportCsvButtonProps) {
  function download() {
    const lines = [
      headers.map(csvCell).join(","),
      ...rows.map((row) => row.map(csvCell).join(",")),
    ];
    const blob = new Blob([`${lines.join("\n")}\n`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="min-h-11 w-full rounded-lg border border-border px-3 text-sm font-medium text-foreground md:min-h-0 md:w-auto md:py-1.5 md:text-xs"
    >
      {label}
    </button>
  );
}
