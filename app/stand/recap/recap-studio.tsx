"use client";

import type { AgDataSourcesDefinition, AgFieldDefinition, AgReportState } from "ag-studio";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { useEffect, useMemo, useState } from "react";
import type { RecapData } from "@/lib/recap";

const POLL_MS = 3000;

function moneyFormat(currency: string) {
  return { format: new Intl.NumberFormat(undefined, { style: "currency", currency }) };
}

function toDataSources(recap: RecapData, currency: string): AgDataSourcesDefinition {
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
        data: recap.sales.map((s) => ({ ...s, paidAt: new Date(s.paidAt) })),
      },
      {
        id: "lines",
        name: "Items sold",
        fields: lineFields,
        data: recap.lines.map((l) => ({ ...l, paidAt: new Date(l.paidAt) })),
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

const initialState: AgReportState = {
  pages: [
    {
      id: "recap",
      widgets: {
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
        byItem: { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 14 },
        unitsChart: { xTrack: 12, yTrack: 0, xSpan: 12, ySpan: 14 },
        sales: { xTrack: 0, yTrack: 14, xSpan: 24, ySpan: 14 },
      },
    },
  ],
  selectedPageId: "recap",
  panels: { filters: { collapsed: true }, edit: { collapsed: true } },
};

export function RecapStudio({ licenseKey, currency }: { licenseKey: string | null; currency: string }) {
  const [recap, setRecap] = useState<RecapData | null>(null);

  // Poll for paid sales. Studio reloads only when the set of sales changes, so a new sale appears within seconds.
  useEffect(() => {
    let signature = "";
    let stopped = false;
    async function load() {
      try {
        const res = await fetch("/api/stand/recap", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const next = (await res.json()) as RecapData;
        const nextSignature = next.sales.map((s) => s.id).join(",");
        if (nextSignature !== signature) {
          signature = nextSignature;
          setRecap(next);
        }
      } catch {
        // Keep showing the last data; the next poll retries.
      }
    }
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  const data = useMemo(() => (recap ? toDataSources(recap, currency) : undefined), [recap, currency]);

  return (
    <AgStudioProvider licenseKey={licenseKey ?? undefined}>
      <div style={{ height: "100%", width: "100%" }}>
        <AgStudio data={data} initialState={initialState} mode="view" />
      </div>
    </AgStudioProvider>
  );
}
