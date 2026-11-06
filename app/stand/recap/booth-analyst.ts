import { createAiHarness, directLlmRunner, type AgAiHarnessSetupParams, type AgStudioApi } from "ag-studio";
import type { RecapData } from "@/lib/recap";
import { claudeAdapter } from "./claude-adapter";
import { itemLeaders, receiptRef } from "./recap-metrics";

export function boothAnalyst(
  { api: coreApi }: AgAiHarnessSetupParams,
  readRecap: () => RecapData | null,
  currency: string,
  selectedPayPalReceipt?: () => string | null,
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
        scope: "All captured stand payments, after any deals. Totals and item leaders are net of refunds",
        paymentCount: recap.sales.filter((sale) => sale.status === "Paid").length,
        totalCents: recap.sales.reduce((sum, sale) => sum + Math.round(sale.total * 100), 0),
        refundCount: recap.sales.filter((sale) => sale.status === "Refunded").length,
        refundedCents: recap.sales.reduce((sum, sale) => sum + Math.round(sale.refunded * 100), 0),
        ...itemLeaders(totals),
      };
      return ctx.success(JSON.stringify(summary));
    },
  });

  const checkReceipt = selectedPayPalReceipt && api.defineAiTool({
    name: "check_paypal_receipt",
    description: "Read the seller-selected receipt's live PayPal Sandbox capture, fee and net at capture. Amounts are in integer cents.",
    params: (s) => s.object({}),
    execute: async (_, ctx) => {
      const id = selectedPayPalReceipt();
      if (!id || !readRecap()?.sales.some((sale) => sale.id === id && sale.hasPayPalReceipt)) {
        return ctx.error("Open a receipt from Recent sales and choose Check with PayPal in Booth Analyst first.");
      }
      try {
        const res = await fetch(`/api/stand/sales/${encodeURIComponent(id)}/paypal-receipt`, { signal: ctx.signal });
        const body = await res.json();
        if (!res.ok) return ctx.error(body.error ?? "PayPal couldn't check this receipt.");
        return ctx.success(JSON.stringify({ receipt: receiptRef(id), source: "PayPal Sandbox MCP", ...body }));
      } catch {
        return ctx.error("PayPal couldn't check this receipt.");
      }
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
            "Refunds are full. A refunded receipt keeps its row with status Refunded and counts 0 toward net totals, units and item sales. For refund questions use sales.refunded, lines.refundedUnits and lines.refunded, or refundCount and refundedCents from the summary. You can't issue refunds: the seller taps a receipt in Recent sales to refund it.",
            checkReceipt && "Use check_paypal_receipt when asked to check the selected receipt with PayPal or explain its fees. Report the returned capture status, whether the amount and currency match, and any available fee and net at capture. Net at capture is before refunds and is not profit or a payout. Treat null values as unavailable. If the lookup fails, explain that PayPal could not verify it. Do not substitute dashboard totals or invent values.",
            "When the seller asks to add a chart, make the requested canvas change using Studio's tools or delegate to its widget specialist. Preserve existing widgets unless the seller asks to replace them.",
          ].join("\n"),
          tools: (ctx, params) => [summarize, ...(checkReceipt ? [checkReceipt] : []), ...(lead.tools?.(ctx, params) ?? [])],
        }),
        ...[builtIn.data, builtIn.page, builtIn.planning, builtIn.widget].map((agent) =>
          directLlmRunner({ ...agent, adapter: claudeAdapter }),
        ),
      ],
      primary: "lead",
      promptStarters: [
        ...(checkReceipt ? [{ label: "Check selected receipt", prompt: "Check my selected receipt with PayPal. What did PayPal capture, and what was the net after fees at capture?" }] : []),
        { label: "Compare my leaders", prompt: "Use the stand summary to compare my top item by units and my top item by sales." },
        { label: "Chart sales by item", prompt: "Add a column chart titled Sales by item. Use Items sold → Item for the categories and sum of Items sold → Item sales for the values. Keep my existing units chart. Tell me which item led by sales." },
        { label: "What did refunds cost?", prompt: "Use the stand summary to tell me how many sales I refunded and how much went back, then which items were refunded using Items sold → Units refunded." },
        { label: "Chart deals", prompt: "Add a chart of deal savings by item using sum of Items sold → Deal savings." },
      ],
    };
  });
}
