"use client";

import {
  AgStudioAiModule,
  createAiHarness,
  studioTheme,
  type AgAiHarnessSetup,
  type AgAiPromptStarter,
  type AgStudioApi,
  type AgDataEngine,
  type AgDataSourcesDefinition,
  type AgFieldDefinition,
  type AgReportState,
  type AgStudioReadyEvent,
  type AgWidgetFormParams,
} from "ag-studio";
import { AgStudio, AgStudioProvider, createWidgets } from "ag-studio-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RecapData } from "@/lib/recap";
import { claudeAdapter } from "./claude-adapter";
import { TodaySalesWidget, type RecapRegistry, type TodaySalesDef } from "./today-widget";

// Opening suggestions in the assistant panel. They show until the first message is sent.
const PROMPT_STARTERS: AgAiPromptStarter[] = [
  { label: "What sold by item", prompt: "Show me what sold today by item." },
  { label: "Best seller", prompt: "Which item made the most money today, and how many did I sell?" },
  { label: "Sales over time", prompt: "Add a chart of sales over time today." },
];

// Studio's built-in agents, run on Claude through our server route so the key stays server-side.
// The setup params are typed with the core API, but Studio passes its full API at runtime.
const ai: AgAiHarnessSetup = ({ api }) =>
  createAiHarness(api as AgStudioApi, { adapter: claudeAdapter, promptStarters: PROMPT_STARTERS });

// Citrus Glass tokens, read as CSS variables so Studio follows light and dark mode with the rest of the app.
const lemonTheme = studioTheme.withParams({
  accentColor: "var(--lemon-deep)",
  backgroundColor: "var(--surface)",
  foregroundColor: "var(--ink)",
  textColor: "var(--ink)",
  fontFamily: "var(--font-hanken), ui-sans-serif, system-ui, sans-serif",
  borderRadius: "14px",
  chartPaletteFills1Color: "var(--lemon-deep)",
  chartPaletteStrokes1Color: "var(--peel)",
  chartPaletteFills2Color: "var(--leaf)",
  chartPaletteStrokes2Color: "var(--leaf)",
  chartPaletteFills3Color: "var(--pool)",
  chartPaletteStrokes3Color: "var(--pool)",
  chartPaletteFills4Color: "var(--berry)",
  chartPaletteStrokes4Color: "var(--berry)",
});

// Adds the custom "Today's sales" widget next to Studio's built-in ones.
const widgets = createWidgets<RecapRegistry>({
  additionalTypes: [
    {
      id: "todaySales",
      label: "Today's sales",
      dataMapping: {
        paidAt: { type: "field", supportedRoles: ["temporal"], requires: { cardinality: "many" }, required: true },
        gross: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true },
        units: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true },
      },
      // Studio's standard edit form, with a picker for each mapped field.
      form: (params: AgWidgetFormParams<TodaySalesDef>) =>
        params.createDefaults({
          dataMappingItems: [
            { key: "paidAt", label: "Paid at" },
            { key: "gross", label: "Sales" },
            { key: "units", label: "Units" },
          ],
        }),
      comp: TodaySalesWidget,
      defaultSize: { width: 360, height: 220 },
      minSize: { width: 240, height: 160 },
      ai: { description: "Gross sales, number of sales and units sold today at the stand, from captured PayPal payments." },
    },
  ],
});

const POLL_MS = 2000;

function moneyFormat(currency: string) {
  return { format: new Intl.NumberFormat(undefined, { style: "currency", currency }) };
}

// Studio's date formats need Date values; the API sends ISO strings.
const saleRows = (recap: RecapData) => recap.sales.map((s) => ({ ...s, paidAt: new Date(s.paidAt) }));
const lineRows = (recap: RecapData) => recap.lines.map((l) => ({ ...l, paidAt: new Date(l.paidAt) }));

function toDataSources(recap: RecapData, currency: string): AgDataSourcesDefinition<RecapRegistry> {
  const money = moneyFormat(currency);
  const saleFields: AgFieldDefinition[] = [
    { id: "id", name: "Sale", format: "textFormat" },
    { id: "paidAt", name: "Paid at", format: "dateTimeFormat" },
    { id: "units", name: "Units", format: "integerFormat" },
    { id: "total", name: "Total", format: "currencyFormat", formatOptions: money },
  ];
  const lineFields: AgFieldDefinition[] = [
    { id: "id", name: "Line", format: "textFormat" },
    { id: "saleId", name: "Sale", format: "textFormat" },
    { id: "item", name: "Item", format: "textFormat" },
    { id: "quantity", name: "Units sold", format: "integerFormat" },
    { id: "unitPrice", name: "Unit price", format: "currencyFormat", formatOptions: money },
    { id: "lineTotal", name: "Sales", format: "currencyFormat", formatOptions: money },
    { id: "paidAt", name: "Paid at", format: "dateTimeFormat" },
  ];
  return {
    description: "Completed PayPal sales at a pop-up stand. Only captured payments are included.",
    sources: [
      {
        id: "sales",
        name: "Sales",
        fields: saleFields,
        // New sales are added in place by transaction, keyed by sale id.
        transactions: "add",
        primaryKeyField: "id",
        data: saleRows(recap),
      },
      {
        id: "lines",
        name: "Items sold",
        fields: lineFields,
        transactions: "add",
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

const initialState: AgReportState<RecapRegistry> = {
  pages: [
    {
      id: "recap",
      widgets: {
        today: {
          type: "todaySales",
          dataMapping: {
            paidAt: [{ id: "sales.paidAt" }],
            gross: [{ id: "sales.total", aggregation: "sum" }],
            units: [{ id: "sales.units", aggregation: "sum" }],
          },
        },
        itemFilter: {
          type: "button-filter",
          dataMapping: { value: [{ id: "lines.item" }] },
          format: { title: { enabled: true, text: "Filter by item" } },
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
        unitsChart: {
          type: "column-chart-grouped",
          dataMapping: {
            categoryKey: [{ id: "lines.item" }],
            valueKey: [{ id: "lines.quantity", aggregation: "sum" }],
            tooltipKey: [],
          },
          format: { title: { enabled: true, text: "Units sold by item" } },
        },
        sales: {
          type: "grid",
          dataMapping: {
            cols: [{ id: "sales.paidAt" }, { id: "sales.units" }, { id: "sales.total" }],
          },
          format: { title: { enabled: true, text: "Paid sales" } },
        },
      },
      widgetLayout: {
        // The filter's title takes about 70px, and its item buttons need 50px more below it.
        today: { xTrack: 0, yTrack: 0, xSpan: 9, ySpan: 13 },
        unitsChart: { xTrack: 9, yTrack: 0, xSpan: 15, ySpan: 13 },
        itemFilter: { xTrack: 0, yTrack: 13, xSpan: 24, ySpan: 13 },
        byItem: { xTrack: 0, yTrack: 26, xSpan: 10, ySpan: 16 },
        sales: { xTrack: 10, yTrack: 26, xSpan: 14, ySpan: 16 },
      },
    },
  ],
  selectedPageId: "recap",
  // Start with the dashboard at full width on a tablet. The assistant and data panels open with one tap.
  panels: { ai: { collapsed: true }, filters: { collapsed: true }, edit: { collapsed: true }, data: { collapsed: true } },
};

export function RecapStudio({ licenseKey, currency }: { licenseKey: string | null; currency: string }) {
  const [initial, setInitial] = useState<RecapData | null>(null);
  const engine = useRef<AgDataEngine | null>(null);

  // Load paid sales once, then poll and add only sales Studio hasn't seen, so widgets update in place.
  useEffect(() => {
    const known = new Set<string>();
    let loaded = false;
    let busy = false;
    let stopped = false;

    async function poll() {
      if (busy || stopped) return;
      busy = true;
      try {
        const res = await fetch("/api/stand/recap", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const recap = (await res.json()) as RecapData;
        if (!loaded) {
          loaded = true;
          recap.sales.forEach((s) => known.add(s.id));
          setInitial(recap);
          return;
        }
        const fresh = recap.sales.filter((s) => !known.has(s.id));
        const apply = engine.current?.applyTransaction?.bind(engine.current);
        // Until Studio is ready there's no engine; the next poll picks these sales up.
        if (fresh.length === 0 || !apply) return;
        const freshIds = new Set(fresh.map((s) => s.id));
        const delta = { sales: fresh, lines: recap.lines.filter((l) => freshIds.has(l.saleId)) };
        // Both tables change together or not at all.
        await apply([
          { tableId: "sales", add: saleRows(delta) },
          { tableId: "lines", add: lineRows(delta) },
        ]);
        freshIds.forEach((id) => known.add(id));
      } catch (error) {
        console.error("Recap update failed", error);
      } finally {
        busy = false;
      }
    }

    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  // Built once from the first load; later sales arrive as transactions, not a new data prop.
  const data = useMemo(() => (initial ? toDataSources(initial, currency) : undefined), [initial, currency]);

  function onStudioReady(event: AgStudioReadyEvent) {
    engine.current = event.api.getDataEngine() ?? null;
  }

  return (
    <AgStudioProvider licenseKey={licenseKey ?? undefined} modules={[AgStudioAiModule]}>
      <div style={{ height: "100%", width: "100%" }}>
        <AgStudio<RecapRegistry>
          // Without an explicit size, Studio's own wrapper falls back to 600px tall.
          style={{ height: "100%", width: "100%" }}
          data={data}
          initialState={initialState}
          widgets={widgets}
          theme={lemonTheme}
          ai={ai}
          // The assistant adds and changes widgets, which needs edit mode.
          mode="edit"
          onStudioReady={onStudioReady}
        />
      </div>
    </AgStudioProvider>
  );
}
