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
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RecapData } from "@/lib/recap";
import { standApi } from "@/lib/stands";
import { isThinking, subscribeThinking } from "./claude-adapter";
import { Button, CheckIcon, ClockIcon, ExclamationIcon, Pill, SparklesIcon, Spinner } from "@/components/kit";
import { filterButtonStyle, lemonTheme } from "./studio-theme";
import { useSetFirstSale } from "./first-sale";
import { boothAnalyst } from "./booth-analyst";
import { onHandoff, PHONE_QUERY, takeHandoff } from "../pal/handoff";
import { receiptDay, receiptRef, receiptTime } from "./recap-metrics";
import { ProductLeadersWidget, RecapCurrency, SalesPulseWidget, type ProductLeadersDef, type RecapRegistry, type SalesPulseDef } from "./recap-widgets";
import { ReceiptSheet, RecapActions, RecentSalesWidget, type RecentSalesDef } from "./recent-sales";

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
        status: category,
      },
      form: (params: AgWidgetFormParams<SalesPulseDef>) =>
        params.createDefaults({
          dataMappingItems: [
            { key: "sale", label: "Sale ID" },
            { key: "paidAt", label: "Paid at" },
            { key: "total", label: "Captured total" },
            { key: "units", label: "Units" },
            { key: "status", label: "Status" },
          ],
        }),
      comp: SalesPulseWidget,
      defaultSize: { width: 460, height: 255 },
      minSize: { width: 200, height: 225 },
      ai: { description: "Net captured PayPal sales after refunds, payment count, units, refund count and latest receipt. Ignores item selections." },
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
    {
      id: "recentSales",
      label: "Recent sales",
      dataMapping: {
        sale: category,
        paidAt: { type: "field", supportedRoles: ["temporal"], requires: { cardinality: "many" }, required: true },
        captured: numeric,
        status: category,
      },
      form: (params: AgWidgetFormParams<RecentSalesDef>) =>
        params.createDefaults({
          dataMappingItems: [
            { key: "sale", label: "Sale ID" },
            { key: "paidAt", label: "Paid at" },
            { key: "captured", label: "Captured total" },
            { key: "status", label: "Status" },
          ],
        }),
      comp: RecentSalesWidget,
      defaultSize: { width: 420, height: 320 },
      minSize: { width: 240, height: 200 },
      ai: { description: "The latest receipts with their Paid or Refunded status. The seller taps one to see its items and refund it in full." },
    },
  ],
});

const aiToolDisplay = {
  check_paypal_receipt: { label: () => ({ text: "Check receipt with PayPal Sandbox" }) },
  start_refund: { label: () => ({ text: "Open refund for you to confirm" }) },
  look_up_receipt: { label: () => ({ text: "Look up receipt" }) },
};

const localeText: AgStudioLocaleText = { filterWidgetFilterBy: "", panelTitleAi: "Booth Analyst" };

const POLL_MS = 2000;

function moneyFormat(currency: string) {
  return { format: new Intl.NumberFormat(undefined, { style: "currency", currency }) };
}

// Studio's date formats need Date values; the API sends ISO strings.
// `day` is midnight of the payment's day in the viewer's own time zone, so a chart can group sales by day.
const startOfDay = (iso: string) => {
  const date = new Date(iso);
  date.setHours(0, 0, 0, 0);
  return date;
};
const saleRows = (recap: RecapData) =>
  recap.sales.map((s) => ({ ...s, receipt: receiptRef(s.id), paidAt: new Date(s.paidAt), day: startOfDay(s.paidAt) }));
const lineRows = (recap: RecapData) => recap.lines.map((l) => ({ ...l, paidAt: new Date(l.paidAt) }));

function toDataSources(recap: RecapData, currency: string): AgDataSourcesDefinition {
  const money = moneyFormat(currency);
  const saleFields: AgFieldDefinition[] = [
    { id: "id", name: "Sale ID", format: "textFormat" },
    { id: "receipt", name: "Receipt", format: "textFormat" },
    { id: "paidAt", name: "Paid at", format: "dateTimeFormat", formatOptions: { format: receiptTime } },
    { id: "status", name: "Status", format: "textFormat" },
    { id: "units", name: "Units", format: "integerFormat" },
    { id: "total", name: "Net total", format: "currencyFormat", formatOptions: money },
    { id: "captured", name: "Captured", format: "currencyFormat", formatOptions: money },
    { id: "refunded", name: "Refunded", format: "currencyFormat", formatOptions: money },
    { id: "channel", name: "Channel", format: "textFormat" },
    { id: "day", name: "Day", format: "dateTimeFormat", formatOptions: { format: receiptDay } },
    { id: "fulfillment", name: "Fulfillment", format: "textFormat" },
    { id: "shipping", name: "Shipping charged", format: "currencyFormat", formatOptions: money },
    { id: "country", name: "Ship to country", format: "textFormat" },
    { id: "region", name: "Ship to region", format: "textFormat" },
    { id: "shippedOrders", name: "Orders shipped", format: "integerFormat" },
  ];
  const lineFields: AgFieldDefinition[] = [
    { id: "id", name: "Line", format: "textFormat" },
    { id: "saleId", name: "Sale", format: "textFormat" },
    { id: "item", name: "Item", format: "textFormat" },
    { id: "status", name: "Status", format: "textFormat" },
    // Short, so "Units (sum)" fits the narrow grid column without truncating.
    { id: "quantity", name: "Units", format: "integerFormat" },
    { id: "unitPrice", name: "Unit price", format: "currencyFormat", formatOptions: money },
    { id: "lineTotal", name: "Item sales", format: "currencyFormat", formatOptions: money },
    { id: "discount", name: "Deal savings", format: "currencyFormat", formatOptions: money },
    { id: "refundedUnits", name: "Units refunded", format: "integerFormat" },
    { id: "refunded", name: "Item refunds", format: "currencyFormat", formatOptions: money },
    { id: "paidAt", name: "Paid at", format: "dateTimeFormat", formatOptions: { format: receiptTime } },
    { id: "category", name: "Category", format: "textFormat" },
    { id: "finish", name: "Finish", format: "textFormat" },
    { id: "channel", name: "Channel", format: "textFormat" },
  ];
  return {
    description:
      "Captured PayPal payments at a pop-up stand. Sales has one row per receipt. Items sold has one row per receipt line. " +
      "Item sales and receipt totals are after deals. A refunded receipt keeps its row with Status Refunded: its net total, units and item sales are 0, " +
      "and what went back is in Sales → Refunded and Items sold → Units refunded and Item refunds. Sales → Captured is what PayPal took before any refund. " +
      "Channel is Stand (rung up at the register) or Online (the seller's web store). Fulfillment is At the stand, Pickup or Shipped. " +
      "Ship to country and region are set only for shipped orders and read Not shipped otherwise; Orders shipped is 1 per shipped order. " +
      "Sales → Day is the calendar day of the payment. Items sold → Category and Finish describe the item, such as Animals and Holographic.",
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
            status: [{ id: "sales.status" }],
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
        recent: {
          type: "recentSales",
          dataMapping: {
            sale: [{ id: "sales.id" }],
            paidAt: [{ id: "sales.paidAt" }],
            captured: [{ id: "sales.captured", aggregation: "sum" }],
            status: [{ id: "sales.status" }],
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
            cols: [{ id: "sales.receipt" }, { id: "sales.paidAt" }, { id: "sales.status" }, { id: "sales.total" }],
          },
          sort: [{ field: { id: "sales.paidAt" }, direction: "desc" }],
          format: { title: { enabled: true, text: "Receipts" }, crossFilter: "filter" },
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
        daily: {
          type: "column-chart-stacked",
          dataMapping: {
            categoryKey: [{ id: "sales.day" }],
            valueKey: [{ id: "sales.total", aggregation: "sum" }],
            legendKey: [{ id: "sales.channel" }],
            tooltipKey: [],
          },
          sort: [{ field: { id: "sales.day" }, direction: "asc" }],
          format: {
            title: { enabled: true, text: "Daily sales by channel" },
            // The colors mean Stand and Online, so say so.
            style: { theme: { common: { legend: { enabled: true, position: "top" } } } },
          },
        },
        categories: {
          type: "donut-chart",
          dataMapping: {
            categoryKey: [{ id: "lines.category" }],
            valueKey: [{ id: "lines.lineTotal", aggregation: "sum" }],
            tooltipKey: [],
          },
          format: { title: { enabled: true, text: "Item sales by category" }, crossFilter: "highlight" },
        },
        pivot: {
          type: "pivot-grid",
          dataMapping: {
            rows: [{ id: "lines.category" }, { id: "lines.item" }],
            columns: [{ id: "lines.finish" }],
            values: [{ id: "lines.lineTotal", aggregation: "sum" }],
          },
          format: { title: { enabled: true, text: "Category and finish" } },
        },
        places: {
          type: "treemap-chart",
          dataMapping: {
            categoryKey: [{ id: "sales.country" }, { id: "sales.region" }],
            valueKey: [{ id: "sales.shippedOrders", aggregation: "sum" }],
            tooltipKey: [],
          },
          format: { title: { enabled: true, text: "Where orders ship" } },
        },
        fulfillment: {
          type: "grid",
          dataMapping: {
            cols: [
              { id: "sales.fulfillment" },
              { id: "sales.units", aggregation: "sum" },
              { id: "sales.shipping", aggregation: "sum" },
              { id: "sales.total", aggregation: "sum" },
            ],
          },
          format: { title: { enabled: true, text: "How buyers got it" } },
        },
      },
      widgetLayout: {
        pulse: { xTrack: 0, yTrack: 0, xSpan: 13, ySpan: 19 },
        leaders: { xTrack: 13, yTrack: 0, xSpan: 11, ySpan: 19 },
        recent: { xTrack: 0, yTrack: 19, xSpan: 12, ySpan: 22 },
        unitsChart: { xTrack: 12, yTrack: 19, xSpan: 12, ySpan: 22 },
        itemFilter: { xTrack: 0, yTrack: 41, xSpan: 24, ySpan: 12 },
        sales: { xTrack: 0, yTrack: 53, xSpan: 12, ySpan: 20 },
        byItem: { xTrack: 12, yTrack: 53, xSpan: 12, ySpan: 20 },
        daily: { xTrack: 0, yTrack: 73, xSpan: 24, ySpan: 22 },
        categories: { xTrack: 0, yTrack: 95, xSpan: 9, ySpan: 24 },
        fulfillment: { xTrack: 9, yTrack: 95, xSpan: 15, ySpan: 24 },
        pivot: { xTrack: 0, yTrack: 119, xSpan: 24, ySpan: 26 },
        places: { xTrack: 0, yTrack: 145, xSpan: 24, ySpan: 24 },
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
const PHONE = PHONE_QUERY;


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

// New sales are added, reset ones removed, and a sale whose status changed (a refund) is updated in place,
// so its row stays put and every total drops without the dashboard reloading.
function changes(previous: RecapData, next: RecapData): AgDataTransaction[] {
  const before = new Map(previous.sales.map((sale) => [sale.id, sale.status]));
  const nextSales = new Set(next.sales.map((sale) => sale.id));
  const fresh = next.sales.filter((sale) => !before.has(sale.id));
  const changed = next.sales.filter((sale) => before.has(sale.id) && before.get(sale.id) !== sale.status);
  const removed = previous.sales.filter((sale) => !nextSales.has(sale.id));
  if (!fresh.length && !changed.length && !removed.length) return [];

  const linesOf = (sales: RecapData["sales"]) => {
    const ids = new Set(sales.map((sale) => sale.id));
    return { sales, lines: next.lines.filter((line) => ids.has(line.saleId)) };
  };
  const additions = linesOf(fresh);
  const updates = linesOf(changed);
  return [
    { tableId: "sales", add: saleRows(additions), update: saleRows(updates), remove: removed.map((sale) => sale.id) },
    {
      tableId: "lines",
      add: lineRows(additions),
      update: lineRows(updates),
      remove: previous.lines.filter((line) => !nextSales.has(line.saleId)).map((line) => line.id),
    },
  ];
}

export function RecapStudio({
  licenseKey,
  currency,
  standId,
  paypalReceiptCheck,
}: {
  licenseKey: string | null;
  currency: string;
  standId: string;
  paypalReceiptCheck: boolean;
}) {
  const [data, setData] = useState<AgDataEngine | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [studioApi, setStudioApi] = useState<AgStudioApi | null>(null);
  const phone = useMedia(PHONE);
  const thinking = useSyncExternalStore(subscribeThinking, isThinking, () => false);
  const applied = useRef<RecapData | null>(null);
  const [recap, setRecap] = useState<RecapData | null>(null);
  // The id stays set while the sheet animates closed, so its content doesn't vanish mid-close.
  // `n` counts openings, so reopening a receipt starts its refund steps afresh.
  // `confirm` opens it at the refund confirmation, for a refund the seller asked Booth Analyst to start.
  const [receipt, setReceipt] = useState<{ id: string; open: boolean; n: number; confirm?: boolean } | null>(null);
  const selectedPayPalReceipt = useRef<string | null>(null);
  const [payPalReceiptId, setPayPalReceiptId] = useState<string | null>(null);
  const pollNow = useRef<() => void>(() => {});
  const actions = useMemo(() => ({ openReceipt: (id: string) => setReceipt((r) => ({ id, open: true, n: (r?.n ?? 0) + 1 })) }), []);
  const setFirstSale = useSetFirstSale();
  const ai: AgAiHarnessSetup = useCallback(
    (params) =>
      boothAnalyst(params, () => applied.current, currency, {
        selectedPayPalReceipt: paypalReceiptCheck ? () => selectedPayPalReceipt.current : undefined,
        startRefund: (id) => setReceipt((r) => ({ id, open: true, n: (r?.n ?? 0) + 1, confirm: true })),
      }),
    [currency, paypalReceiptCheck],
  );

  useEffect(() => {
    let busy = false;
    let engine: AgDataEngine | null = null;
    const controller = new AbortController();

    async function poll() {
      if (busy || controller.signal.aborted) return;
      busy = true;
      try {
        const res = await fetch(standApi("/api/stand/recap", standId), { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(`Recap request returned ${res.status}`);
        const response = (await res.json()) as RecapData;
        if (controller.signal.aborted) return;
        const sales = response.sales.filter((sale) => sale.currency === currency);
        const saleIds = new Set(sales.map((sale) => sale.id));
        const recap = { sales, lines: response.lines.filter((line) => saleIds.has(line.saleId)) };

        let changed = false;
        if (!engine) {
          // Share the engine across phone and desktop layouts so a rotation keeps the live ledger.
          engine = createDataEngine(toDataSources(recap, currency));
          setData(engine);
          changed = true;
        } else if (applied.current && engine.applyTransaction) {
          const transactions = changes(applied.current, recap);
          if (transactions.length) await engine.applyTransaction(transactions);
          changed = transactions.length > 0;
        }
        if (controller.signal.aborted) return;
        applied.current = recap;
        if (changed) setRecap(recap);
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
    pollNow.current = () => void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
      engine?.dispose?.();
    };
  }, [currency, standId, setFirstSale]);

  function onStudioReady(event: AgStudioReadyEvent) {
    setStudioApi(event.api);
  }

  const openAnalyst = useCallback(() => {
    if (!studioApi) return;
    const state = studioApi.getState();
    studioApi.setState({ ...state, panels: { ...state.panels, ai: { ...state.panels?.ai, collapsed: false } } });
  }, [studioApi]);

  // A question Pal handed over: open Booth Analyst and type it into its box, for the seller to send.
  // Studio has no API for the box, so this fills its textarea once the panel has drawn it.
  useEffect(() => {
    if (!studioApi || phone) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const deliver = () => {
      const prompt = takeHandoff();
      if (!prompt) return;
      openAnalyst();
      let tries = 0;
      const fill = () => {
        const box = document.querySelector<HTMLTextAreaElement>(".ag-studio-ai-assistant-textarea");
        if (!box) {
          if (tries++ < 40) timers.push(setTimeout(fill, 50));
          return;
        }
        box.value = prompt;
        box.dispatchEvent(new Event("input", { bubbles: true }));
        box.focus();
        box.setSelectionRange(prompt.length, prompt.length);
      };
      fill();
    };
    deliver();
    const stop = onHandoff(deliver);
    return () => {
      stop();
      timers.forEach(clearTimeout);
    };
  }, [studioApi, phone, openAnalyst]);

  function selectPayPalReceipt(id: string) {
    selectedPayPalReceipt.current = id;
    setPayPalReceiptId(id);
    setReceipt((r) => r ? { ...r, open: false } : r);
    openAnalyst();
  }

  return (
    <RecapCurrency value={currency}>
      <RecapActions value={actions}>
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
              {!phone && recap?.sales.some((sale) => sale.id === payPalReceiptId) && payPalReceiptId && (
                <span className="text-footnote text-ink-2" role="status">
                  Receipt {receiptRef(payPalReceiptId)} selected. Ask “Check my selected receipt.”
                </span>
              )}
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
                aiToolDisplay={aiToolDisplay}
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
      {receipt && (
        <ReceiptSheet
          key={`${receipt.id}:${receipt.n}`}
          saleId={receipt.open ? receipt.id : null}
          shownId={receipt.id}
          recap={recap}
          currency={currency}
          onClose={() => setReceipt((r) => (r ? { ...r, open: false } : r))}
          onRefunded={() => pollNow.current()}
          onCheckPayPal={paypalReceiptCheck && !phone && studioApi ? selectPayPalReceipt : undefined}
          confirmRefund={receipt.confirm}
        />
      )}
      </RecapActions>
    </RecapCurrency>
  );
}
