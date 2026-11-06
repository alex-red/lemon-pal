"use client";

import type {
  AgBaseRegistry,
  AgBaseWidgetDefinition,
  AgDefaultWidgetDefinition,
  AgWidgetFieldReference,
  AgWidgetParams,
} from "ag-studio";
import { AgIncompleteDataMappingOverlay, AgNoDataOverlay } from "ag-studio-react";
import { use } from "react";
import { LemonIcon } from "@/components/kit";

/** Report state for the "Today's sales" widget. */
export interface TodaySalesDef {
  type: "todaySales";
  dataMapping: {
    paidAt: AgWidgetFieldReference[];
    gross: AgWidgetFieldReference[];
    units: AgWidgetFieldReference[];
  };
}

export interface RecapRegistry extends AgBaseRegistry {
  widgets: readonly (AgDefaultWidgetDefinition | AgBaseWidgetDefinition<"todaySales", TodaySalesDef>)[];
}

function isToday(value: unknown) {
  if (value == null) return false;
  const date = value instanceof Date ? value : new Date(value as string | number);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  );
}

/**
 * The headline number on the recap: what the stand took in today, how many sales and how many units.
 * It groups paid sales by their paid time and adds up the ones from today in the seller's time zone.
 * Studio re-runs the query when a new sale arrives by transaction, so the totals update live.
 */
export function TodaySalesWidget({ widgetApi, dataMapping }: AgWidgetParams<TodaySalesDef>) {
  const paidAt = dataMapping.paidAt?.at(0);
  const gross = dataMapping.gross?.at(0);
  const units = dataMapping.units?.at(0);
  if (!paidAt || !gross || !units) return <AgIncompleteDataMappingOverlay />;

  const response = use(widgetApi.getData({ fields: [paidAt, gross, units] }, { queryId: "today" }));
  const today = response.results.rows.filter((row) => isToday(row[paidAt.key]));
  if (response.results.rows.length === 0) return <AgNoDataOverlay />;

  const sum = (key: string) => today.reduce((n, row) => n + (Number(row[key]) || 0), 0);
  const total = sum(gross.key);
  const unitCount = sum(units.key);

  // No padding of its own: the card inset comes from studio-layout.ts, as for every widget.
  return (
    // A size container, so the total steps down to fit a narrow card instead of being cut off.
    <div className="@container flex h-full flex-col justify-center gap-3 font-sans text-ink">
      <p className="flex items-center gap-1.5 text-footnote font-semibold text-ink-2">
        <LemonIcon className="text-[1.1rem]" /> Today&rsquo;s sales
      </p>
      <p className="font-price text-title1 font-semibold whitespace-nowrap @[11rem]:text-large-title @[17rem]:text-hero">{widgetApi.formatFieldValue(gross, total)}</p>
      <p className="text-body text-ink-2 tabular-nums">
        {today.length} {today.length === 1 ? "sale" : "sales"} · {unitCount} {unitCount === 1 ? "item" : "items"} sold
      </p>
    </div>
  );
}
