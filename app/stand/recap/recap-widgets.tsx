"use client";

import type {
  AgBaseRegistry,
  AgBaseWidgetDefinition,
  AgDefaultWidgetDefinition,
  AgWidgetFieldReference,
  AgWidgetParams,
} from "ag-studio";
import { AgIncompleteDataMappingOverlay } from "ag-studio-react";
import { createContext, use, type ReactNode } from "react";
import { Button, CheckIcon, ChevronRightIcon, LemonIcon, Money, SaleStatusPill, TagIcon, WalletIcon } from "@/components/kit";
import { itemLeaders, receiptRef, receiptTime } from "./recap-metrics";
import type { RecentSalesDef } from "./recent-sales";

export const RecapCurrency = createContext("USD");

export interface SalesPulseDef {
  type: "salesPulse";
  dataMapping: Record<"sale" | "paidAt" | "total" | "units" | "status", AgWidgetFieldReference[]>;
}

export interface ProductLeadersDef {
  type: "productLeaders";
  dataMapping: Record<"item" | "units" | "sales", AgWidgetFieldReference[]>;
}

export interface RecapRegistry extends AgBaseRegistry {
  widgets: readonly (
    | AgDefaultWidgetDefinition
    | AgBaseWidgetDefinition<"salesPulse", SalesPulseDef>
    | AgBaseWidgetDefinition<"productLeaders", ProductLeadersDef>
    | AgBaseWidgetDefinition<"recentSales", RecentSalesDef>
  )[];
}

export function SalesPulseWidget({ widgetApi, dataMapping }: AgWidgetParams<SalesPulseDef>) {
  const currency = use(RecapCurrency);
  const sale = dataMapping.sale?.at(0);
  const paidAt = dataMapping.paidAt?.at(0);
  const total = dataMapping.total?.at(0);
  const units = dataMapping.units?.at(0);
  const status = dataMapping.status?.at(0);
  if (!sale || !paidAt || !total || !units || !status) return <AgIncompleteDataMappingOverlay />;

  // Keep this stand-wide. Product selection should never turn a basket total into item revenue.
  const { results } = use(widgetApi.getData(
    { fields: [sale, paidAt, status, total, units], sort: [{ field: paidAt, direction: "desc" }] },
    { queryId: "sales-pulse", filter: false, crossFilter: "none" },
  ));
  // Refunded receipts count nothing toward the total. They're listed in Recent sales, and noted here.
  const kept = results.rows.filter((row) => row[status.key] !== "Refunded");
  const refunds = results.rows.length - kept.length;
  const count = kept.length;
  const cents = kept.reduce((sum, row) => sum + Math.round(Number(row[total.key]) * 100), 0);
  const unitCount = kept.reduce((sum, row) => sum + Number(row[units.key]), 0);
  const last = kept[0];

  return (
    <div className="@container flex h-full min-w-0 flex-col justify-center-safe gap-3 rounded-field bg-lemon-soft p-4 @[27rem]:px-6">
      <div className="flex items-center gap-2 text-footnote font-semibold text-ink-2">
        <LemonIcon className="text-peel" /> Stand total
      </div>
      <div aria-live="polite">
        <Money cents={cents} currency={currency} size="title" rolling className="leading-none @[21rem]:text-large-title @[30rem]:text-hero" />
        <p className="mt-2 text-subhead text-ink-2">
          <strong className="font-price text-ink">{count}</strong> {count === 1 ? "payment" : "payments"} ·{" "}
          <strong className="font-price text-ink">{unitCount}</strong> {unitCount === 1 ? "item" : "items"} sold
          {refunds > 0 && (
            <>
              {" · "}
              <strong className="font-price text-berry">{refunds}</strong> refunded
            </>
          )}
        </p>
      </div>
      <div className="mt-1 border-t border-hairline pt-3">
        {last ? (
          <div key={String(last[sale.key])} className="flex animate-rise flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="min-w-0">
              <p className="text-footnote font-semibold">Latest payment · {receiptRef(String(last[sale.key]))}</p>
              <p className="text-caption text-ink-2">{receiptTime.format(new Date(last[paidAt.key]))}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Money cents={Math.round(Number(last[total.key]) * 100)} currency={currency} />
              <SaleStatusPill status="paid" />
            </div>
          </div>
        ) : (
          <p className="text-subhead text-ink-2">Your first PayPal payment will appear here.</p>
        )}
      </div>
    </div>
  );
}

export function ProductLeadersWidget({ widgetApi, dataMapping }: AgWidgetParams<ProductLeadersDef>) {
  const currency = use(RecapCurrency);
  const item = dataMapping.item?.at(0);
  const units = dataMapping.units?.at(0);
  const sales = dataMapping.sales?.at(0);
  if (!item || !units || !sales) return <AgIncompleteDataMappingOverlay />;

  const { results } = use(widgetApi.getData(
    { fields: [item, units, sales] },
    { queryId: "product-leaders", filter: false, crossFilter: "none" },
  ));
  const { byUnits, bySales } = itemLeaders(results.rows.map((row) => ({
    item: String(row[item.key]),
    units: Number(row[units.key]),
    cents: Math.round(Number(row[sales.key]) * 100),
  })));
  const selection = widgetApi.getCrossFilterSelections()?.find((filter) => filter.type === "value")?.values[0];
  const pick = (value: string) => {
    if (selection === value) widgetApi.resetCrossFilter();
    else widgetApi.toggleCrossFilter({ type: "value", group: 0, field: item, value, reset: true });
  };

  return (
    <div className="flex h-full flex-col justify-center-safe gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-headline font-semibold">Standouts</p>
        {selection != null && (
          <Button variant="plain" size="sm" onClick={() => widgetApi.resetCrossFilter()}>
            Clear
          </Button>
        )}
      </div>
      {byUnits.length > 0 ? (
        <>
          <Leader
            label="Most units"
            icon={<TagIcon />}
            names={byUnits.map((row) => row.item)}
            value={<>{byUnits[0].units} sold</>}
            selection={selection}
            onSelect={pick}
          />
          <Leader
            label="Most sales"
            icon={<WalletIcon />}
            names={bySales.map((row) => row.item)}
            value={<Money cents={bySales[0].cents} currency={currency} />}
            selection={selection}
            onSelect={pick}
          />
          <p className="text-caption text-ink-2">Select an item to see its receipts.</p>
        </>
      ) : (
        <p className="text-subhead text-ink-2">Your best sellers will show here once a payment clears.</p>
      )}
    </div>
  );
}

function Leader({ label, icon, names, value, selection, onSelect }: {
  label: string;
  icon: ReactNode;
  names: string[];
  value: ReactNode;
  selection: unknown;
  onSelect: (item: string) => void;
}) {
  const name = names[0];
  const selected = selection === name;
  return (
    <div className="rounded-field bg-fill">
      <p className="flex items-center gap-1.5 px-3 pt-2 text-caption font-semibold text-ink-2">
        {icon} {label}{names.length > 1 ? " · tied" : ""}
      </p>
      <button
        type="button"
        onClick={() => onSelect(name)}
        aria-pressed={selected}
        aria-label={`Filter by ${name}`}
        className="focus-ring flex min-h-11 w-full items-center justify-between gap-2 rounded-field px-3 text-left hover:bg-fill-2 aria-pressed:bg-lemon-soft"
      >
        <span className="min-w-0 truncate text-callout font-semibold" title={names.join(", ")}>
          {name}{names.length > 1 ? ` +${names.length - 1}` : ""}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-subhead font-semibold tabular-nums">
          {value} {selected ? <CheckIcon /> : <ChevronRightIcon />}
        </span>
      </button>
    </div>
  );
}
