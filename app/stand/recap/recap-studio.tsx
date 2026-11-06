"use client";

import {
  AgStudioAiModule,
  createDataEngine,
  type AgPanelConfig,
  type AgResponsiveLayoutBreakpoint,
  type AgStudioApi,
  type AgAiHarnessSetup,
  type AgDataTransaction,
  type AgDataMappingDefinition,
  type AgStudioLocaleText,
  type AgDataEngine,
  type AgDataSourcesDefinition,
  type AgFieldDefinition,
  type AgReportState,
  type AgStudioReadyEvent,
  type AgWidgetFormParams,
} from "ag-studio";
import { AgStudio, AgStudioProvider, createWidgets } from "ag-studio-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RecapData } from "@/lib/recap";
import { isThinking, subscribeThinking } from "./claude-adapter";
import { Button, CheckIcon, ClockIcon, ExclamationIcon, Pill, SparklesIcon, Spinner } from "@/components/kit";
import { filterButtonStyle, lemonTheme } from "./studio-theme";
import { useSetFirstSale } from "./first-sale";
import { boothAnalyst } from "./booth-analyst";
import { receiptRef, receiptTime } from "./recap-metrics";
import { ProductLeadersWidget, RecapCurrency, SalesPulseWidget, type ProductLeadersDef, type RecapRegistry, type SalesPulseDef } from "./recap-widgets";

const category: AgDataMappingDefinition<string> = { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true };
const numeric: AgDataMappingDefinition<string> = { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true };

const widgets = createWidgets<RecapRegistry>({
  additionalTypes: [
    {
      id: "salesPulse",
      label: "Stand total",
      dataMapping: {
        sale: category,
        paidAt: { type: "field", supportedRoles: ["temporal"], requires: { cardinality: "many" }, required: true },
        total: numeric,
        units: numeric,
      },
      form: (params: AgWidgetFormParams<SalesPulseDef>) =>
        params.createDefaults({
          dataMappingItems: [
            { key: "sale", label: "Sale ID" },
            { key: "paidAt", label: "Paid at" },
            { key: "total", label: "Captured total" },
            { key: "units", label: "Units" },
          ],
        }),
      comp: SalesPulseWidget,
      defaultSize: { width: 460, height: 255 },
      minSize: { width: 200, height: 225 },
      ai: { description: "Captured PayPal sales, payment count, units and latest receipt. Ignores item selections." },
    },
    {
      id: "productLeaders",
      label: "Standouts",
      dataMapping: { item: category, units: numeric, sales: numeric },
      form: (params: AgWidgetFormParams<ProductLeadersDef>) =>
        params.createDefaults({
          dataMappingItems: [
            { key: "item", label: "Item" },
            { key: "units", label: "Units" },
            { key: "sales", label: "Item sales" },
          ],
        }),
      comp: ProductLeadersWidget,
      defaultSize: { width: 420, height: 255 },
      minSize: { width: 200, height: 225 },
      ai: { description: "Compare the top items by units and sales. Select an item to filter the linked receipts." },
    },
  ],
});

const localeText: AgStudioLocaleText = { filterWidgetFilterBy: "", panelTitleAi: "Booth Analyst" };

const POLL_MS = 2000;

function moneyFormat(currency: string) {
  return { format: new Intl.NumberFormat(undefined, { style: "currency", currency }) };
}

// Studio's date formats need Date values; the API sends ISO strings.
const saleRows = (recap: RecapData) => recap.sales.map((s) => ({ ...s, receipt: receiptRef(s.id), paidAt: new Date(s.paidAt) }));
const lineRows = (recap: RecapData) => recap.lines.map((l) => ({ ...l, paidAt: new Date(l.paidAt) }));

function toDataSources(recap: RecapData, currency: string): AgDataSourcesDefinition {
  const money = moneyFormat(currency);
  const saleFields: AgFieldDefinition[] = [
    { id: "id", name: "Sale ID", format: "textFormat" },
    { id: "receipt", name: "Receipt", format: "textFormat" },
    { id: "paidAt", name: "Paid at", format: "dateTimeFormat", formatOptions: { format: receiptTime } },
    { id: "units", name: "Units", format: "integerFormat" },
    { id: "total", name: "Receipt total", format: "currencyFormat", formatOptions: money },
  ];
  const lineFields: AgFieldDefinition[] = [
    { id: "id", name: "Line", format: "textFormat" },
    { id: "saleId", name: "Sale", format: "textFormat" },
    { id: "item", name: "Item", format: "textFormat" },
    // Short, so "Units (sum)" fits the narrow grid column without truncating.
    { id: "quantity", name: "Units", format: "integerFormat" },
    { id: "unitPrice", name: "Unit price", format: "currencyFormat", formatOptions: money },
    { id: "lineTotal", name: "Item sales", format: "currencyFormat", formatOptions: money },
    { id: "discount", name: "Deal savings", format: "currencyFormat", formatOptions: money },
    { id: "paidAt", name: "Paid at", format: "dateTimeFormat", formatOptions: { format: receiptTime } },
  ];
  return {
    description: "Captured PayPal payments at a pop-up stand. Sales has one row per receipt. Items sold has one row per receipt line. Item sales and receipt totals are after deals.",
    sources: [
      {
        id: "sales",
        name: "Sales",
        fields: saleFields,
        transactions: "all",
        primaryKeyField: "id",
        data: saleRows(recap),
      },
      {
        id: "lines",
        name: "Items sold",
        fields: lineFields,
        transactions: "all",
        primaryKeyField: "id",
        data: lineRows(recap),
      },
    ],
    relationships: [
      {
        id: "lines-sales",
        source: { tableId: "lines", fieldId: "saleId" },
        target: { tableId: "sales", fieldId: "id" },
        type: "many-to-one",
      },
    ],
  };
}

// Every panel starts collapsed, so the dashboard gets the width.
const collapsedPanels = {
  ai: { collapsed: true },
  filters: { collapsed: true },
  edit: { collapsed: true },
  data: { collapsed: true },
};

const initialState: AgReportState<RecapRegistry> = {
  pages: [
    {
      id: "recap",
      widgets: {
        pulse: {
          type: "salesPulse",
          dataMapping: {
            sale: [{ id: "sales.id" }],
            paidAt: [{ id: "sales.paidAt" }],
            total: [{ id: "sales.total", aggregation: "sum" }],
            units: [{ id: "sales.units", aggregation: "sum" }],
          },
        },
        leaders: {
          type: "productLeaders",
          dataMapping: {
            item: [{ id: "lines.item" }],
            units: [{ id: "lines.quantity", aggregation: "sum" }],
            sales: [{ id: "lines.lineTotal", aggregation: "sum" }],
          },
        },
        unitsChart: {
          type: "bar-chart-grouped",
          dataMapping: {
            categoryKey: [{ id: "lines.item" }],
            valueKey: [{ id: "lines.quantity", aggregation: "sum" }],
            tooltipKey: [],
          },
          sort: [{ field: { id: "lines.quantity", aggregation: "sum" }, direction: "desc" }],
          format: { title: { enabled: true, text: "Units sold by item" }, crossFilter: "highlight" },
        },
        sales: {
          type: "grid",
          dataMapping: {
            cols: [{ id: "sales.receipt" }, { id: "sales.paidAt" }, { id: "sales.total" }],
          },
          sort: [{ field: { id: "sales.paidAt" }, direction: "desc" }],
          format: { title: { enabled: true, text: "Paid receipts" }, crossFilter: "filter" },
        },
        itemFilter: {
          type: "button-filter",
          dataMapping: { value: [{ id: "lines.item" }] },
          format: { title: { enabled: true, text: "Filter by item" }, style: filterButtonStyle },
        },
        byItem: {
          type: "grid",
          dataMapping: {
            cols: [
              { id: "lines.item" },
              { id: "lines.quantity", aggregation: "sum" },
              { id: "lines.lineTotal", aggregation: "sum" },
            ],
          },
          format: { title: { enabled: true, text: "Sold by item" } },
        },
      },
      widgetLayout: {
        pulse: { xTrack: 0, yTrack: 0, xSpan: 13, ySpan: 19 },
        leaders: { xTrack: 13, yTrack: 0, xSpan: 11, ySpan: 19 },
        unitsChart: { xTrack: 0, yTrack: 19, xSpan: 12, ySpan: 20 },
        sales: { xTrack: 12, yTrack: 19, xSpan: 12, ySpan: 20 },
        itemFilter: { xTrack: 0, yTrack: 39, xSpan: 24, ySpan: 12 },
        byItem: { xTrack: 0, yTrack: 51, xSpan: 24, ySpan: 20 },
      },
    },
  ],
  selectedPageId: "recap",
  // Start with the dashboard at full width on a tablet. The assistant and data panels open with one tap.
  panels: collapsedPanels,
};

/*
 * Sizes. Studio's side panels each take a rail, and its assistant and its responsive layouts need different
 * modes (edit and view). So phones, upright or on their side, get view mode with no panels and the widgets
 * stacked one per row; Studio has no assistant in view mode. Everything wider gets edit mode and the assistant.
 */
const PHONE = "(max-width: 39.99rem), (orientation: landscape) and (max-height: 34rem)";


function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// Every widget full width, in the order the dashboard lists them, at its authored height.
const stacked: AgResponsiveLayoutBreakpoint[] = [
  {
    layout: (candidates, { columns }) => {
      let y = 0;
      return candidates.map(({ layout }) => {
        const next = { xTrack: 0, yTrack: y, xSpan: columns, ySpan: layout.ySpan };
        y += layout.ySpan;
        return next;
      });
    },
  },
];

const phonePanels: AgPanelConfig = { view: { left: [], right: [] } };

function changes(previous: RecapData, next: RecapData): AgDataTransaction[] {
  const previousSales = new Set(previous.sales.map((sale) => sale.id));
  const nextSales = new Set(next.sales.map((sale) => sale.id));
  const fresh = next.sales.filter((sale) => !previousSales.has(sale.id));
  const removed = previous.sales.filter((sale) => !nextSales.has(sale.id));
  if (!fresh.length && !removed.length) return [];

  const freshIds = new Set(fresh.map((sale) => sale.id));
  const additions = { sales: fresh, lines: next.lines.filter((line) => freshIds.has(line.saleId)) };
  return [
    { tableId: "sales", add: saleRows(additions), remove: removed.map((sale) => sale.id) },
    { tableId: "lines", add: lineRows(additions), remove: previous.lines.filter((line) => !nextSales.has(line.saleId)).map((line) => line.id) },
  ];
}

export function RecapStudio({ licenseKey, currency }: { licenseKey: string | null; currency: string }) {
  const [data, setData] = useState<AgDataEngine | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [studioApi, setStudioApi] = useState<AgStudioApi | null>(null);
  const phone = useMedia(PHONE);
  const thinking = useSyncExternalStore(subscribeThinking, isThinking, () => false);
  const applied = useRef<RecapData | null>(null);
  const setFirstSale = useSetFirstSale();
  const ai: AgAiHarnessSetup = useCallback(
    (params) => boothAnalyst(params, () => applied.current, currency),
    [currency],
  );

  useEffect(() => {
    let busy = false;
    let engine: AgDataEngine | null = null;
    const controller = new AbortController();

    async function poll() {
      if (busy || controller.signal.aborted) return;
      busy = true;
      try {
        const res = await fetch("/api/stand/recap", { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(`Recap request returned ${res.status}`);
        const response = (await res.json()) as RecapData;
        if (controller.signal.aborted) return;
        const sales = response.sales.filter((sale) => sale.currency === currency);
        const saleIds = new Set(sales.map((sale) => sale.id));
        const recap = { sales, lines: response.lines.filter((line) => saleIds.has(line.saleId)) };

        if (!engine) {
          // Share the engine across phone and desktop layouts so a rotation keeps the live ledger.
          engine = createDataEngine(toDataSources(recap, currency));
          setData(engine);
        } else if (applied.current && engine.applyTransaction) {
          const transactions = changes(applied.current, recap);
          if (transactions.length) await engine.applyTransaction(transactions);
        }
        if (controller.signal.aborted) return;
        applied.current = recap;
        setFirstSale?.(response.firstSaleSeconds ?? null);
        setOnline(true);
      } catch (error) {
        if (!controller.signal.aborted) {
          setOnline(false);
          console.error("Recap update failed", error);
        }
      } finally {
        busy = false;
      }
    }

    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
      engine?.dispose?.();
    };
  }, [currency, setFirstSale]);

  function onStudioReady(event: AgStudioReadyEvent) {
    setStudioApi(event.api);
  }

  function openAnalyst() {
    if (!studioApi) return;
    const state = studioApi.getState();
    studioApi.setState({ ...state, panels: { ...state.panels, ai: { ...state.panels?.ai, collapsed: false } } });
  }

  return (
    <RecapCurrency value={currency}>
      <AgStudioProvider licenseKey={licenseKey ?? undefined} modules={[AgStudioAiModule]}>
        <section aria-label="Sales dashboard" className="flex h-full min-h-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline px-4 py-2 sm:px-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div role="status">
                {online ? (
                  <Pill tone="leaf" icon={<CheckIcon />}>Live sales</Pill>
                ) : online === false ? (
                  <Pill tone="berry" icon={<ExclamationIcon />}>Reconnecting</Pill>
                ) : (
                  <Pill icon={<ClockIcon />}>Connecting</Pill>
                )}
              </div>
              <span className="text-footnote text-ink-2">All captured PayPal payments · {currency}</span>
            </div>
            {!phone && (
              <Button variant="filled" icon={<SparklesIcon />} disabled={!studioApi} onClick={openAnalyst}>
                Ask Booth Analyst
              </Button>
            )}
          </div>
          <div data-assistant-thinking={thinking || undefined} className="min-h-0 flex-1">
            {data ? (
              <AgStudio<RecapRegistry>
                key={phone ? "view" : "edit"}
                style={{ height: "100%", width: "100%" }}
                data={data}
                initialState={initialState}
                widgets={widgets}
                theme={lemonTheme}
                localeText={localeText}
                ai={ai}
                mode={phone ? "view" : "edit"}
                panels={phone ? phonePanels : undefined}
                responsiveLayoutBreakpoints={stacked}
                onStudioReady={onStudioReady}
              />
            ) : (
              <p role="status" className="flex h-full items-center justify-center gap-2 text-subhead text-ink-2">
                <Spinner /> Waiting for sales data…
              </p>
            )}
          </div>
        </section>
      </AgStudioProvider>
    </RecapCurrency>
  );
}
