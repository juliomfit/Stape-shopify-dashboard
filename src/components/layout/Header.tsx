import { DateRangeToggle } from "@/components/layout/DateRangeToggle";
import { MenuButton } from "@/components/layout/NavLinks";
import { BrandMark } from "@/components/dashboard/BrandMark";
import { MetaWarehouseChip } from "@/components/layout/MetaWarehouseChip";
import { getSelectedPeriod } from "@/lib/period-server";

type HeaderProps = {
  title: string;
  description?: string;
};

export async function Header({ title, description }: HeaderProps) {
  const period = await getSelectedPeriod();

  return (
    <header
      className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:px-6 lg:py-4"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <MenuButton />
          <div className="min-w-0 pt-0.5">
            <div className="flex items-center gap-2 lg:hidden">
              <BrandMark size={22} />
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
                Goodsnova
              </p>
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground lg:text-xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-muted lg:block">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-stretch gap-2 lg:items-end">
          <DateRangeToggle
            key={`${period.key}:${period.startDate}:${period.endDate}`}
            period={period}
          />
          <MetaWarehouseChip />
        </div>
      </div>
    </header>
  );
}
