"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Columns3, Download, Info, Search } from "lucide-react";
import { DailyTrendChart } from "@/components/dashboard/DailyTrendChart";
import { HorizontalBarList } from "@/components/dashboard/HorizontalBarList";
import { MappingBadge } from "@/components/dashboard/MetaSourceBadges";
import {
  ALL_CAMPAIGNS_KEY,
  FLYWEEL_AD_SPEND_UNAVAILABLE,
  FLYWEEL_ADSET_SPEND_UNAVAILABLE,
  type ObservedEntityDailySeries,
  type ObservedMetaAdRollup,
  type ObservedMetaAdsetRollup,
} from "@/lib/attribution/observed-meta-grain";
import {
  campaignMappingBadge,
  displayCampaignName,
  shortenId,
  type OurCampaignRow,
} from "@/lib/attribution/campaign-map";
import {
  AD_COLUMNS,
  ADSET_COLUMNS,
  CAMPAIGN_COLUMNS,
  COLUMN_PRESETS,
  DEFAULT_CAMPAIGN_COLUMNS,
  FLYWEEL_CAMPAIGN_ONLY_TOOLTIP,
  META_GRID_STORAGE_KEY,
  MISSING_CAMPAIGN_PLATFORM_SERIES,
  adHref,
  adsetHref,
  campaignHref,
  chartMetricCopy,
  chartMetricsForGrain,
  csvEscape,
  filterCampaignsByMapping,
  formatCountCell,
  formatFrequencyCell,
  formatMoneyCell,
  formatOrdersCell,
  formatPercentCell,
  formatRoasCell,
  groupedHeader,
  isPlatformChartMetric,
  parseStoredColumns,
  resolvePlatformDailySeries,
  searchCampaignRows,
  searchText,
  sortAdRows,
  sortAdsetRows,
  sortCampaignRows,
  totalCampaignPerformance,
  visibleCampaignColumns,
  type AdColumnId,
  type AdsetColumnId,
  type CampaignColumnId,
  type ChartMetricId,
  type ColumnPreset,
  type MappingFilter,
  type MetaGrain,
  type PlatformDailySeries,
  type SortDir,
} from "@/lib/attribution/meta-performance-grid";

export type { PlatformDailySeries };

type MetaPerformanceWorkspaceProps = {
  currencyCode: string;
  days: string[];
  campaigns: OurCampaignRow[];
  adsets: ObservedMetaAdsetRollup[];
  ads: ObservedMetaAdRollup[];
  campaignSeries: ObservedEntityDailySeries[];
  adsetSeries: ObservedEntityDailySeries[];
  adSeries: ObservedEntityDailySeries[];
  allCampaigns: ObservedEntityDailySeries;
  platformDaily: PlatformDailySeries;
  platformDailyByCampaign?: Record<string, PlatformDailySeries>;
};

function readStoredColumns(): CampaignColumnId[] {
  if (typeof window === "undefined") return DEFAULT_CAMPAIGN_COLUMNS;
  try {
    return parseStoredColumns(window.localStorage.getItem(META_GRID_STORAGE_KEY)) ?? DEFAULT_CAMPAIGN_COLUMNS;
  } catch {
    return DEFAULT_CAMPAIGN_COLUMNS;
  }
}

function saveColumns(ids: CampaignColumnId[]) {
  try {
    window.localStorage.setItem(META_GRID_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / private mode */
  }
}

function MappingHelp() {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="rounded-full p-0.5 text-muted hover:text-foreground"
        aria-label="Mapping help"
        onClick={() => setOpen((value) => !value)}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <span className="absolute right-0 z-20 mt-6 w-72 rounded-lg border border-border bg-surface p-3 text-[11px] font-normal normal-case tracking-normal text-muted shadow-lg">
          Exact native Meta ID = HIGH. Unique canonical campaign name = PARTIAL.
          Flyweel campaign UUID is internal and not Meta campaign.id.
        </span>
      ) : null}
    </span>
  );
}

function grainNote(grain: MetaGrain) {
  if (grain === "adsets") {
    return "GoodsNova first-party attribution · Flyweel platform spend unavailable at ad-set grain.";
  }
  if (grain === "ads") {
    return "GoodsNova first-party attribution · Flyweel does not provide ad-level spend.";
  }
  return "Platform campaign metrics from Flyweel with GoodsNova first-party attribution.";
}

function ourRoasSeries(revenue: number[], spend: number[]) {
  return revenue.map((value, index) => {
    const cost = spend[index] ?? 0;
    return cost > 0 ? value / cost : 0;
  });
}

export function MetaPerformanceWorkspace({
  currencyCode,
  days,
  campaigns,
  adsets,
  ads,
  campaignSeries,
  adsetSeries,
  adSeries,
  allCampaigns,
  platformDaily,
  platformDailyByCampaign = {},
}: MetaPerformanceWorkspaceProps) {
  const [grain, setGrain] = useState<MetaGrain>("campaigns");
  const [query, setQuery] = useState("");
  const [mappingFilter, setMappingFilter] = useState<MappingFilter>("all");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleIds, setVisibleIds] = useState<CampaignColumnId[]>(readStoredColumns);
  const [sortKey, setSortKey] = useState<string>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [chartMetric, setChartMetric] = useState<ChartMetricId>("spend");
  const [entityOverride, setEntityOverride] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);

  const chartOptions = chartMetricsForGrain(grain);
  const activeChartMetric = chartOptions.some((row) => row.id === chartMetric)
    ? chartMetric
    : "ourRevenue";

  const entityOptions = useMemo(() => {
    if (grain === "adsets") return adsetSeries;
    if (grain === "ads") return adSeries;
    return [allCampaigns, ...campaignSeries.filter((row) => row.key !== ALL_CAMPAIGNS_KEY)];
  }, [grain, adsetSeries, adSeries, allCampaigns, campaignSeries]);

  const defaultEntityKey =
    grain === "campaigns"
      ? ALL_CAMPAIGNS_KEY
      : grain === "adsets"
        ? (adsetSeries[0]?.key ?? "")
        : (adSeries[0]?.key ?? "");
  const entityKey =
    entityOverride && entityOptions.some((row) => row.key === entityOverride)
      ? entityOverride
      : defaultEntityKey;
  const selectedEntity = entityOptions.find((row) => row.key === entityKey) ?? entityOptions[0] ?? null;

  const campaignRows = useMemo(() => {
    const filtered = filterCampaignsByMapping(searchCampaignRows(campaigns, query), mappingFilter);
    return sortCampaignRows(filtered, sortKey as CampaignColumnId, sortDir);
  }, [campaigns, query, mappingFilter, sortKey, sortDir]);

  const adsetRows = useMemo(() => {
    const filtered = adsets.filter(
      (row) => searchText(row.adsetLabel, query) || searchText(row.campaignLabel, query),
    );
    return sortAdsetRows(filtered, sortKey as AdsetColumnId, sortDir);
  }, [adsets, query, sortKey, sortDir]);

  const adRows = useMemo(() => {
    const filtered = ads.filter(
      (row) =>
        searchText(row.adLabel, query) ||
        searchText(row.parentAdsetId || "", query) ||
        searchText(row.parentCampaignId || "", query),
    );
    return sortAdRows(filtered, sortKey as AdColumnId, sortDir);
  }, [ads, query, sortKey, sortDir]);

  const campaignCols = visibleCampaignColumns(visibleIds);
  const totals = totalCampaignPerformance(campaignRows);

  const platformForEntity =
    grain === "campaigns"
      ? resolvePlatformDailySeries({
          entityKey,
          allCampaignsKey: ALL_CAMPAIGNS_KEY,
          platformDaily,
          platformDailyByCampaign,
        })
      : null;
  const platformSeriesMissing =
    grain === "campaigns" &&
    entityKey !== ALL_CAMPAIGNS_KEY &&
    platformForEntity == null;
  const chartCopy = chartMetricCopy(activeChartMetric);
  const needsPlatformSeries =
    isPlatformChartMetric(activeChartMetric) || activeChartMetric === "ourRoas";
  const showMissingPlatformSeries = platformSeriesMissing && needsPlatformSeries;

  const timeSeriesValues = useMemo(() => {
    const our = selectedEntity?.points ?? [];
    const revenue = our.map((point) => point.revenue);
    const orders = our.map((point) => point.attributedOrders);
    switch (activeChartMetric) {
      case "spend":
        return platformForEntity?.spend ?? null;
      case "metaRevenue":
        return platformForEntity?.purchase_value ?? null;
      case "metaRoas":
        return platformForEntity?.roas ?? null;
      case "purchases":
        return platformForEntity?.purchases ?? null;
      case "cpa":
        return platformForEntity?.cpa ?? null;
      case "ourRevenue":
        return revenue;
      case "ourRoas":
        return platformForEntity
          ? ourRoasSeries(revenue, platformForEntity.spend)
          : null;
      case "attributedOrders":
        return orders;
      case "newCustomerRevenue":
        return our.map((point) => point.newCustomerRevenue);
      case "newCustomerCredit":
        return our.map((point) => point.newCustomerCredit);
      default:
        return revenue;
    }
  }, [activeChartMetric, selectedEntity, platformForEntity]);

  const barRows = useMemo(() => {
    if (grain === "adsets") {
      return adsetRows.map((row) => ({
        label: row.adsetLabel,
        value:
          activeChartMetric === "attributedOrders"
            ? row.attributedOrders
            : activeChartMetric === "newCustomerCredit"
              ? row.newCustomerCredit
              : activeChartMetric === "newCustomerRevenue"
                ? row.newCustomerRevenue
                : row.attributedRevenue,
      }));
    }
    if (grain === "ads") {
      return adRows.map((row) => ({
        label: row.adLabel,
        value:
          activeChartMetric === "attributedOrders"
            ? row.attributedOrders
            : activeChartMetric === "newCustomerCredit"
              ? row.newCustomerCredit
              : activeChartMetric === "newCustomerRevenue"
                ? row.newCustomerRevenue
                : row.attributedRevenue,
      }));
    }
    return campaignRows.map((row) => {
      const value =
        activeChartMetric === "spend"
          ? row.spend
          : activeChartMetric === "metaRevenue"
            ? row.metaRevenue
            : activeChartMetric === "metaRoas"
              ? row.metaRoas ?? 0
              : activeChartMetric === "purchases"
                ? row.metaPurchases
                : activeChartMetric === "cpa"
                  ? row.metaCpa ?? 0
                  : activeChartMetric === "ourRoas"
                    ? row.ourRoas ?? 0
                    : activeChartMetric === "attributedOrders"
                      ? row.ourOrders
                      : row.ourRevenue;
      return { label: displayCampaignName(row.campaignName), value };
    });
  }, [grain, campaignRows, adsetRows, adRows, activeChartMetric]);

  function toggleSort(next: string) {
    if (sortKey === next) {
      setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(next);
    setSortDir(next === "campaign" || next === "adset" || next === "ad" ? "asc" : "desc");
  }

  function applyPreset(preset: ColumnPreset) {
    setVisibleIds(COLUMN_PRESETS[preset]);
    saveColumns(COLUMN_PRESETS[preset]);
  }

  function toggleColumn(id: CampaignColumnId) {
    if (id === "campaign") return;
    const next = visibleIds.includes(id)
      ? visibleIds.filter((item) => item !== id)
      : [...visibleIds, id];
    setVisibleIds(next);
    saveColumns(next);
  }

  function exportCsv() {
    if (grain === "campaigns") {
      const header = campaignCols.map((column) => column.label).join(",");
      const lines = campaignRows.map((row) =>
        campaignCols
          .map((column) => csvEscape(campaignCsvValue(row, column.id, currencyCode)))
          .join(","),
      );
      downloadCsv(["Campaigns", header, ...lines].join("\n"), "meta-campaigns.csv");
      return;
    }
    if (grain === "adsets") {
      const header = ADSET_COLUMNS.map((column) => column.label).join(",");
      const lines = adsetRows.map((row) =>
        ADSET_COLUMNS.map((column) => csvEscape(adsetCsvValue(row, column.id, currencyCode))).join(","),
      );
      downloadCsv(["Ad Sets", header, ...lines].join("\n"), "meta-adsets.csv");
      return;
    }
    const header = AD_COLUMNS.map((column) => column.label).join(",");
    const lines = adRows.map((row) =>
      AD_COLUMNS.map((column) => csvEscape(adCsvValue(row, column.id, currencyCode))).join(","),
    );
    downloadCsv(["Ads", header, ...lines].join("\n"), "meta-ads.csv");
  }

  const extra =
    grain === "adsets"
      ? FLYWEEL_ADSET_SPEND_UNAVAILABLE
      : grain === "ads"
        ? FLYWEEL_AD_SPEND_UNAVAILABLE
        : "";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["campaigns", "adsets", "ads"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setGrain(key);
              setEntityOverride(null);
              setSortKey(key === "campaigns" ? "spend" : "ourRevenue");
              setSortDir("desc");
              setChartMetric(key === "campaigns" ? "spend" : "ourRevenue");
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              grain === key ? "bg-accent text-white" : "bg-elevated text-muted"
            }`}
          >
            {key === "campaigns" ? "Campaigns" : key === "adsets" ? "Ad Sets" : "Ads"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm">
          Metric
          <select
            value={activeChartMetric}
            onChange={(event) => setChartMetric(event.target.value as ChartMetricId)}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
          >
            {chartOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        {entityOptions.length > 1 ? (
          <label className="flex items-center gap-2 text-sm">
            {grain === "campaigns" ? "Campaign" : grain === "adsets" ? "Ad set" : "Ad"}
            <select
              value={selectedEntity?.key ?? ""}
              onChange={(event) => setEntityOverride(event.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
            >
              {entityOptions.map((row) => (
                <option key={row.key} value={row.key}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {showMissingPlatformSeries || timeSeriesValues == null ? (
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">
            {chartOptions.find((row) => row.id === activeChartMetric)?.label ?? "Trend"}
          </h2>
          {selectedEntity?.label ? (
            <p className="mt-1 text-xs text-muted">{selectedEntity.label}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted">Source: {chartCopy.source}</p>
          <p className="mt-6 text-sm text-muted">{MISSING_CAMPAIGN_PLATFORM_SERIES}</p>
        </article>
      ) : (
        <DailyTrendChart
          title={chartOptions.find((row) => row.id === activeChartMetric)?.label ?? "Trend"}
          source={chartCopy.source}
          description={`${selectedEntity?.label ? `${selectedEntity.label}. ` : ""}${chartCopy.description}${
            isPlatformChartMetric(activeChartMetric) ? "" : extra ? ` ${extra}` : ""
          }`}
          days={days}
          seriesA={{
            label: chartOptions.find((row) => row.id === activeChartMetric)?.label ?? "Metric",
            values: timeSeriesValues,
          }}
        />
      )}

      <HorizontalBarList
        title={grain === "campaigns" ? "Campaign breakdown" : grain === "adsets" ? "Ad set breakdown" : "Ad breakdown"}
        description={grainNote(grain)}
        rows={barRows}
        currencyCode={
          activeChartMetric === "ourRevenue" ||
          activeChartMetric === "metaRevenue" ||
          activeChartMetric === "spend" ||
          activeChartMetric === "cpa" ||
          activeChartMetric === "newCustomerRevenue"
            ? currencyCode
            : undefined
        }
      />

      <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Meta Ads Performance</h2>
            <p className="mt-1 text-xs text-muted">{grainNote(grain)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                grain === "campaigns"
                  ? "Search campaigns..."
                  : grain === "adsets"
                    ? "Search ad sets..."
                    : "Search ads..."
              }
              className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-sm"
            />
          </label>
          {grain === "campaigns" ? (
            <select
              value={mappingFilter}
              onChange={(event) => setMappingFilter(event.target.value as MappingFilter)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
            >
              <option value="all">Mapping: All</option>
              <option value="exact_id">Exact ID</option>
              <option value="name_match">Name match</option>
              <option value="needs_mapping">Needs mapping</option>
            </select>
          ) : null}
          {grain === "campaigns" ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setColumnsOpen((value) => !value)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm"
              >
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </button>
              {columnsOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-border bg-surface p-3 shadow-lg">
                  <div className="mb-2 flex flex-wrap gap-1">
                    {(Object.keys(COLUMN_PRESETS) as ColumnPreset[]).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="rounded-full bg-elevated px-2 py-0.5 text-[11px] capitalize"
                      >
                        {preset === "all" ? "All columns" : preset}
                      </button>
                    ))}
                  </div>
                  <ul className="max-h-64 space-y-1 overflow-auto text-sm">
                    {CAMPAIGN_COLUMNS.filter((column) => column.id !== "campaign").map((column) => (
                      <li key={column.id}>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={visibleIds.includes(column.id)}
                            onChange={() => toggleColumn(column.id)}
                          />
                          {column.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>

        {grain === "campaigns" ? (
          <>
            <div className="mt-4 hidden md:block">
              <CampaignGrid
                rows={campaignRows}
                columns={campaignCols}
                totals={totals}
                currencyCode={currencyCode}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
            </div>
            <div className="mt-4 md:hidden">
              <CampaignMobile
                rows={campaignRows}
                currencyCode={currencyCode}
                openKey={mobileOpen}
                onToggle={setMobileOpen}
              />
            </div>
          </>
        ) : null}

        {grain === "adsets" ? (
          <>
            <div className="mt-4 hidden md:block">
              <AdsetGrid rows={adsetRows} currencyCode={currencyCode} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </div>
            <div className="mt-4 space-y-2 md:hidden">
              {adsetRows.map((row) => (
                <Link
                  prefetch={false}
                  key={row.adsetId}
                  href={adsetHref(row.adsetId)}
                  className="block rounded-xl border border-border p-3"
                >
                  <p className="font-medium text-foreground">{row.adsetLabel}</p>
                  <p className="mt-1 text-sm">
                    {formatMoneyCell(row.attributedRevenue, true, currencyCode)} · {formatOrdersCell(row.attributedOrders)} orders
                  </p>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        {grain === "ads" ? (
          <>
            <div className="mt-4 hidden md:block">
              <AdGrid rows={adRows} adsets={adsets} currencyCode={currencyCode} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </div>
            <div className="mt-4 space-y-2 md:hidden">
              {adRows.map((row) => (
                <Link
                  prefetch={false}
                  key={row.adId}
                  href={adHref(row.adId)}
                  className="block rounded-xl border border-border p-3"
                >
                  <p className="font-medium text-foreground">{row.adLabel}</p>
                  <p className="mt-1 text-sm">
                    {formatMoneyCell(row.attributedRevenue, true, currencyCode)} · {formatOrdersCell(row.attributedOrders)} orders
                  </p>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </article>
    </section>
  );
}

function SortHead({
  id,
  label,
  sortKey,
  sortDir,
  onSort,
  sticky,
  extra,
}: {
  id: string;
  label: string;
  sortKey: string;
  sortDir: SortDir;
  onSort: (id: string) => void;
  sticky?: boolean;
  extra?: ReactNode;
}) {
  const active = sortKey === id;
  return (
    <th className={`${sticky ? "sticky-col" : ""} ${id === "campaign" || id === "adset" || id === "ad" ? "" : "num"}`}>
      <button type="button" onClick={() => onSort(id)} className="inline-flex items-center gap-1">
        {label}
        <span className="text-[10px] opacity-70">{active ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
      </button>
      {extra}
    </th>
  );
}

function CampaignGrid({
  rows,
  columns,
  totals,
  currencyCode,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: OurCampaignRow[];
  columns: ReturnType<typeof visibleCampaignColumns>;
  totals: ReturnType<typeof totalCampaignPerformance>;
  currencyCode: string;
  sortKey: string;
  sortDir: SortDir;
  onSort: (id: string) => void;
}) {
  const groups = groupedHeader(columns);
  return (
    <div className="meta-grid-wrap">
      <table className="meta-grid">
        <thead>
          <tr className="meta-grid-groups">
            {groups.map((group) => (
              <th
                key={group.id}
                colSpan={group.span}
                className={
                  group.id === "meta" ? "meta-group-meta" : group.id === "ours" ? "meta-group-ours" : ""
                }
              >
                {group.label}
              </th>
            ))}
          </tr>
          <tr className="meta-grid-cols">
            {columns.map((column) => (
              <SortHead
                key={column.id}
                id={column.id}
                label={column.label}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                sticky={column.sticky}
                extra={column.id === "mapping" ? <MappingHelp /> : null}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-muted">
                No campaigns in this range.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const badge = campaignMappingBadge(row);
              return (
                <tr key={`${row.campaignId ?? row.campaignName}`}>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`${column.sticky ? "sticky-col" : ""} ${column.numeric ? "num" : ""}`}
                      title={
                        !row.platformPresent && isPlatformColumn(column.id)
                          ? FLYWEEL_CAMPAIGN_ONLY_TOOLTIP
                          : undefined
                      }
                    >
                      {column.id === "campaign" ? (
                        <Link prefetch={false} href={campaignHref(row)} className="meta-name font-medium text-foreground hover:underline">
                          {displayCampaignName(row.campaignName)}
                        </Link>
                      ) : column.id === "mapping" ? (
                        <MappingBadge label={badge.label} confidence={badge.confidence} />
                      ) : (
                        campaignCell(row, column.id, currencyCode)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
        <tfoot>
          <tr>
            {columns.map((column) => (
              <td key={column.id} className={`${column.sticky ? "sticky-col" : ""} ${column.numeric ? "num" : ""}`}>
                {column.id === "campaign"
                  ? "Total"
                  : column.id === "mapping"
                    ? ""
                    : totalsCell(totals, column.id, currencyCode)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function isPlatformColumn(id: CampaignColumnId) {
  return [
    "spend",
    "impressions",
    "reach",
    "frequency",
    "clicks",
    "linkClicks",
    "ctr",
    "cpc",
    "cpm",
    "purchases",
    "cpa",
    "metaRevenue",
    "metaRoas",
  ].includes(id);
}

function campaignCell(row: OurCampaignRow, id: CampaignColumnId, currencyCode: string) {
  const platform = row.platformPresent;
  switch (id) {
    case "spend":
      return formatMoneyCell(row.spend, platform, currencyCode);
    case "impressions":
      return formatCountCell(row.impressions, platform);
    case "reach":
      return formatCountCell(row.reach, platform);
    case "frequency":
      return formatFrequencyCell(row.frequency, platform);
    case "clicks":
      return formatCountCell(row.clicks, platform);
    case "linkClicks":
      return formatCountCell(row.linkClicks, platform);
    case "ctr":
      return formatPercentCell(row.ctr);
    case "cpc":
      return formatMoneyCell(row.cpc, row.cpc != null, currencyCode);
    case "cpm":
      return formatMoneyCell(row.cpm, row.cpm != null, currencyCode);
    case "purchases":
      return formatCountCell(row.metaPurchases, platform);
    case "cpa":
      return formatMoneyCell(row.metaCpa, row.metaCpa != null, currencyCode);
    case "metaRevenue":
      return formatMoneyCell(row.metaRevenue, platform, currencyCode);
    case "metaRoas":
      return formatRoasCell(row.metaRoas);
    case "ourRevenue":
      return formatMoneyCell(row.ourRevenue, true, currencyCode);
    case "ourOrders":
      return formatOrdersCell(row.ourOrders);
    case "ourRoas":
      return formatRoasCell(row.ourRoas);
    case "newCustomerCredit":
      return formatOrdersCell(row.newCustomerCredit);
    case "newCustomerRevenue":
      return formatMoneyCell(row.newCustomerRevenue, true, currencyCode);
    case "attributedNcac":
      return formatMoneyCell(row.attributedNcac, row.attributedNcac != null, currencyCode);
    default:
      return "";
  }
}

function totalsCell(
  totals: ReturnType<typeof totalCampaignPerformance>,
  id: CampaignColumnId,
  currencyCode: string,
) {
  switch (id) {
    case "spend":
      return formatMoneyCell(totals.spend, true, currencyCode);
    case "impressions":
      return formatCountCell(totals.impressions);
    case "reach":
      return formatCountCell(totals.reach, false);
    case "frequency":
      return formatFrequencyCell(totals.frequency, false);
    case "clicks":
      return formatCountCell(totals.clicks);
    case "linkClicks":
      return formatCountCell(totals.linkClicks);
    case "ctr":
      return formatPercentCell(totals.ctr);
    case "cpc":
      return formatMoneyCell(totals.cpc, totals.cpc != null, currencyCode);
    case "cpm":
      return formatMoneyCell(totals.cpm, totals.cpm != null, currencyCode);
    case "purchases":
      return formatCountCell(totals.purchases);
    case "cpa":
      return formatMoneyCell(totals.cpa, totals.cpa != null, currencyCode);
    case "metaRevenue":
      return formatMoneyCell(totals.metaRevenue, true, currencyCode);
    case "metaRoas":
      return formatRoasCell(totals.metaRoas);
    case "ourRevenue":
      return formatMoneyCell(totals.ourRevenue, true, currencyCode);
    case "ourOrders":
      return formatOrdersCell(totals.ourOrders);
    case "ourRoas":
      return formatRoasCell(totals.ourRoas);
    case "newCustomerCredit":
      return formatOrdersCell(totals.newCustomerCredit);
    case "newCustomerRevenue":
      return formatMoneyCell(totals.newCustomerRevenue, true, currencyCode);
    case "attributedNcac":
      return formatMoneyCell(totals.attributedNcac, totals.attributedNcac != null, currencyCode);
    default:
      return "";
  }
}

function CampaignMobile({
  rows,
  currencyCode,
  openKey,
  onToggle,
}: {
  rows: OurCampaignRow[];
  currencyCode: string;
  openKey: string | null;
  onToggle: (key: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const key = `${row.campaignId ?? row.campaignName}`;
        const open = openKey === key;
        return (
          <article key={key} className="rounded-xl border border-border p-3">
            <Link prefetch={false} href={campaignHref(row)} className="font-medium text-foreground">
              {displayCampaignName(row.campaignName)}
            </Link>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div>
                <dt className="text-muted">Spend</dt>
                <dd>{formatMoneyCell(row.spend, row.platformPresent, currencyCode)}</dd>
              </div>
              <div>
                <dt className="text-muted">Meta ROAS</dt>
                <dd>{formatRoasCell(row.metaRoas)}</dd>
              </div>
              <div>
                <dt className="text-muted">OUR revenue</dt>
                <dd>{formatMoneyCell(row.ourRevenue, true, currencyCode)}</dd>
              </div>
              <div>
                <dt className="text-muted">OUR ROAS</dt>
                <dd>{formatRoasCell(row.ourRoas)}</dd>
              </div>
              <div>
                <dt className="text-muted">Purchases</dt>
                <dd>{formatCountCell(row.metaPurchases, row.platformPresent)}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="mt-2 text-xs text-accent"
              onClick={() => onToggle(open ? null : key)}
            >
              {open ? "Hide metrics" : "View metrics"}
            </button>
            {open ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div>
                  <dt className="text-muted">Impressions</dt>
                  <dd>{formatCountCell(row.impressions, row.platformPresent)}</dd>
                </div>
                <div>
                  <dt className="text-muted">CTR</dt>
                  <dd>{formatPercentCell(row.ctr)}</dd>
                </div>
                <div>
                  <dt className="text-muted">CPC</dt>
                  <dd>{formatMoneyCell(row.cpc, row.cpc != null, currencyCode)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Attributed orders</dt>
                  <dd>{formatOrdersCell(row.ourOrders)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Mapping</dt>
                  <dd>
                    <MappingBadge
                      label={campaignMappingBadge(row).label}
                      confidence={campaignMappingBadge(row).confidence}
                    />
                  </dd>
                </div>
              </dl>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function AdsetGrid({
  rows,
  currencyCode,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: ObservedMetaAdsetRollup[];
  currencyCode: string;
  sortKey: string;
  sortDir: SortDir;
  onSort: (id: string) => void;
}) {
  const groups = groupedHeader(ADSET_COLUMNS);
  return (
    <div className="meta-grid-wrap">
      <table className="meta-grid">
        <thead>
          <tr className="meta-grid-groups">
            {groups.map((group) => (
              <th key={group.id} colSpan={group.span} className={group.id === "ours" ? "meta-group-ours" : ""}>
                {group.label}
              </th>
            ))}
          </tr>
          <tr className="meta-grid-cols">
            {ADSET_COLUMNS.map((column) => (
              <SortHead
                key={column.id}
                id={column.id}
                label={column.label}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                sticky={column.sticky}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.adsetId}>
              <td className="sticky-col">
                <Link prefetch={false} href={adsetHref(row.adsetId)} className="meta-name font-medium hover:underline">
                  {row.adsetLabel}
                </Link>
              </td>
              <td className="meta-name">{row.campaignLabel}</td>
              <td className="num">{formatMoneyCell(row.attributedRevenue, true, currencyCode)}</td>
              <td className="num">{formatOrdersCell(row.attributedOrders)}</td>
              <td className="num">{formatMoneyCell(row.newCustomerRevenue, true, currencyCode)}</td>
              <td className="num">{formatOrdersCell(row.newCustomerCredit)}</td>
              <td className="num">{formatPercentCell(row.shareOfParentRevenue)}</td>
              <td className="num">{formatCountCell(row.numberOfAds)}</td>
              <td title={FLYWEEL_CAMPAIGN_ONLY_TOOLTIP}>First-party ID</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdGrid({
  rows,
  adsets,
  currencyCode,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: ObservedMetaAdRollup[];
  adsets: ObservedMetaAdsetRollup[];
  currencyCode: string;
  sortKey: string;
  sortDir: SortDir;
  onSort: (id: string) => void;
}) {
  const adsetName = new Map(adsets.map((row) => [row.adsetId, row.adsetLabel]));
  const campaignName = new Map(adsets.map((row) => [row.adsetId, row.campaignLabel]));
  const groups = groupedHeader(AD_COLUMNS);
  return (
    <div className="meta-grid-wrap">
      <table className="meta-grid">
        <thead>
          <tr className="meta-grid-groups">
            {groups.map((group) => (
              <th key={group.id} colSpan={group.span} className={group.id === "ours" ? "meta-group-ours" : ""}>
                {group.label}
              </th>
            ))}
          </tr>
          <tr className="meta-grid-cols">
            {AD_COLUMNS.map((column) => (
              <SortHead
                key={column.id}
                id={column.id}
                label={column.label}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                sticky={column.sticky}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.adId}>
              <td className="sticky-col">
                <Link prefetch={false} href={adHref(row.adId)} className="meta-name font-medium hover:underline">
                  {row.adLabel}
                </Link>
                <div className="mt-0.5 font-mono text-[10px] text-muted">{shortenId(row.adId)}</div>
              </td>
              <td>{adsetName.get(row.parentAdsetId || "") || `Ad Set ${shortenId(row.parentAdsetId)}`}</td>
              <td className="meta-name">{campaignName.get(row.parentAdsetId || "") || displayCampaignName(row.parentCampaignId)}</td>
              <td className="num">{formatMoneyCell(row.attributedRevenue, true, currencyCode)}</td>
              <td className="num">{formatOrdersCell(row.attributedOrders)}</td>
              <td className="num">{formatMoneyCell(row.newCustomerRevenue, true, currencyCode)}</td>
              <td className="num">{formatOrdersCell(row.newCustomerCredit)}</td>
              <td className="num">{formatPercentCell(row.shareOfAdsetRevenue)}</td>
              <td className="num">{formatCountCell(row.numberOfOrders)}</td>
              <td title={FLYWEEL_CAMPAIGN_ONLY_TOOLTIP}>First-party ID</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function campaignCsvValue(row: OurCampaignRow, id: CampaignColumnId, currencyCode: string) {
  if (id === "campaign") return displayCampaignName(row.campaignName);
  if (id === "mapping") {
    const badge = campaignMappingBadge(row);
    return `${badge.label} · ${badge.confidence}`;
  }
  return String(campaignCell(row, id, currencyCode));
}

function adsetCsvValue(row: ObservedMetaAdsetRollup, id: AdsetColumnId, currencyCode: string) {
  switch (id) {
    case "adset":
      return row.adsetLabel;
    case "campaign":
      return row.campaignLabel;
    case "ourRevenue":
      return formatMoneyCell(row.attributedRevenue, true, currencyCode);
    case "ourOrders":
      return formatOrdersCell(row.attributedOrders);
    case "newCustomerRevenue":
      return formatMoneyCell(row.newCustomerRevenue, true, currencyCode);
    case "newCustomerCredit":
      return formatOrdersCell(row.newCustomerCredit);
    case "shareOfCampaign":
      return formatPercentCell(row.shareOfParentRevenue);
    case "ads":
      return String(row.numberOfAds);
    case "source":
      return "First-party ID";
    default:
      return "";
  }
}

function adCsvValue(row: ObservedMetaAdRollup, id: AdColumnId, currencyCode: string) {
  switch (id) {
    case "ad":
      return row.adLabel;
    case "adset":
      return row.parentAdsetId || "";
    case "campaign":
      return row.parentCampaignId || "";
    case "ourRevenue":
      return formatMoneyCell(row.attributedRevenue, true, currencyCode);
    case "ourOrders":
      return formatOrdersCell(row.attributedOrders);
    case "newCustomerRevenue":
      return formatMoneyCell(row.newCustomerRevenue, true, currencyCode);
    case "newCustomerCredit":
      return formatOrdersCell(row.newCustomerCredit);
    case "shareOfAdset":
      return formatPercentCell(row.shareOfAdsetRevenue);
    case "ordersTouched":
      return String(row.numberOfOrders);
    case "source":
      return "First-party ID";
    default:
      return "";
  }
}

function downloadCsv(body: string, filename: string) {
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
