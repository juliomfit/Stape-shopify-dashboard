import { DateRangeToggle } from "@/components/layout/DateRangeToggle";
import { getSelectedRangeDays } from "@/lib/period-server";

type HeaderProps = {
  title: string;
  description?: string;
};

export async function Header({ title, description }: HeaderProps) {
  const rangeDays = await getSelectedRangeDays();

  return (
    <header className="border-b border-border bg-surface/90 px-8 py-6 backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
              {description}
            </p>
          ) : null}
        </div>
        <DateRangeToggle value={rangeDays} />
      </div>
    </header>
  );
}
