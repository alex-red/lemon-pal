import { createAiHarness, directLlmRunner, type AgAiHarnessSetupParams, type AgStudioApi } from "ag-studio";
import type { RecapData } from "@/lib/recap";
import { claudeAdapter } from "./claude-adapter";
import { itemLeaders } from "./recap-metrics";

export function boothAnalyst(
  { api: coreApi }: AgAiHarnessSetupParams,
  readRecap: () => RecapData | null,
  currency: string,
) {
  const api = coreApi as AgStudioApi;
  const summarize = api.defineAiTool({
    name: "summarize_booth_sales",
    description: "Read exact stand-wide totals and tied item leaders across all captured PayPal payments, ignoring dashboard filters. Monetary values are in integer cents.",
    params: (s) => s.object({}),
    execute: (_, ctx) => {
      const recap = readRecap();
      if (!recap) return ctx.error("Sales are still loading.");
      const items = new Map<string, { item: string; units: number; cents: number }>();
      for (const line of recap.lines) {
        const item = items.get(line.item) ?? { item: line.item, units: 0, cents: 0 };
        item.units += line.quantity;
        item.cents += Math.round(line.lineTotal * 100);
        items.set(line.item, item);
      }
      const totals = [...items.values()];
      const summary = {
        currency,
        scope: "All captured stand payments, after any deals",
        paymentCount: recap.sales.length,
        totalCents: recap.sales.reduce((sum, sale) => sum + Math.round(sale.total * 100), 0),
        ...itemLeaders(totals),
      };
      return ctx.success(JSON.stringify(summary));
    },
  });

  return createAiHarness(api, ({ builtIn }) => {
    const lead = builtIn.lead;
    return {
      agents: [
        directLlmRunner({
          ...lead,
          name: "Booth Analyst",
          adapter: claudeAdapter,
          instructions: (ctx, params) => [
            lead.instructions?.(ctx, params),
            "You are Lemon Pal's Booth Analyst. Use summarize_booth_sales for exact stand-wide numbers and rankings. Its scope ignores dashboard filters. Use Studio's data agent for questions about a filter, an item, or a time range.",
            "For item sales use the sum of lines.lineTotal, after deals. For units use the sum of lines.quantity. Keep captured basket totals (sales.total) at receipt grain. Preserve ties and do not infer profit or stock from sales.",
            "When the seller asks to add a chart, make the requested canvas change using Studio's tools or delegate to its widget specialist. Preserve existing widgets unless the seller asks to replace them.",
          ].join("\n"),
          tools: (ctx, params) => [summarize, ...(lead.tools?.(ctx, params) ?? [])],
        }),
        ...[builtIn.data, builtIn.page, builtIn.planning, builtIn.widget].map((agent) =>
          directLlmRunner({ ...agent, adapter: claudeAdapter }),
        ),
      ],
      primary: "lead",
      promptStarters: [
        { label: "Compare my leaders", prompt: "Use the stand summary to compare my top item by units and my top item by sales." },
        { label: "Chart sales by item", prompt: "Add a column chart titled Sales by item. Use Items sold → Item for the categories and sum of Items sold → Item sales for the values. Keep my existing units chart. Tell me which item led by sales." },
        { label: "Chart deals", prompt: "Add a chart of deal savings by item using sum of Items sold → Deal savings." },
      ],
    };
  });
}
