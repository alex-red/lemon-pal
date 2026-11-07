import { createAiHarness, directLlmRunner, type AgAiHarnessSetupParams, type AgAiParamsBuilder, type AgStudioApi } from "ag-studio";
import type { RecapData } from "@/lib/recap";
import { claudeAdapter } from "./claude-adapter";
import { itemLeaders, receiptRef } from "./recap-metrics";

export function boothAnalyst(
  { api: coreApi }: AgAiHarnessSetupParams,
  readRecap: () => RecapData | null,
  currency: string,
  {
    selectedPayPalReceipt,
    startRefund,
  }: {
    /** The receipt the seller picked for a PayPal check, when receipt checks are on. */
    selectedPayPalReceipt?: () => string | null;
    /** Opens a receipt at its refund confirmation. The seller still has to confirm. */
    startRefund: (saleId: string) => void;
  },
) {
  const api = coreApi as AgStudioApi;

  // The model names receipts by the short reference the dashboard shows, like #3F2A9C1B.
  function findReceipt(ref: string | undefined) {
    const recap = readRecap();
    const wanted = ref?.trim().replace(/^#/, "").toUpperCase();
    if (!wanted) {
      const id = selectedPayPalReceipt?.();
      return id ? recap?.sales.find((sale) => sale.id === id) : undefined;
    }
    return recap?.sales.find((sale) => receiptRef(sale.id) === `#${wanted}`);
  }
  const receiptParam = (s: AgAiParamsBuilder) =>
    s.string({ description: "The receipt's reference as the dashboard shows it, such as #3F2A9C1B." });
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
    description: "Read a receipt's live capture, fee and net at capture from PayPal Sandbox, through PayPal's MCP server. Pass the receipt reference, or leave it out for the receipt the seller selected. Amounts are in integer cents.",
    params: (s) => s.object({ receipt: receiptParam(s).optional() }),
    execute: async ({ receipt }, ctx) => {
      const sale = findReceipt(receipt);
      if (!sale) {
        return ctx.error(receipt ? `No receipt ${receipt} on this stand.` : "Name a receipt, or open one from Recent sales and choose Check with PayPal in Booth Analyst.");
      }
      if (!sale.hasPayPalReceipt) return ctx.error(`Receipt ${receiptRef(sale.id)} is sample data with no PayPal payment to check.`);
      const id = sale.id;
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

  const lookUp = api.defineAiTool({
    name: "look_up_receipt",
    description: "Read one receipt's current status (Paid or Refunded), time, captured and refunded amounts and items, as Lemon Pal recorded them. Pass the receipt reference, or leave it out for the receipt the seller selected, else the latest receipt. Amounts are in integer cents.",
    params: (s) => s.object({ receipt: receiptParam(s).optional() }),
    execute: ({ receipt }, ctx) => {
      const recap = readRecap();
      if (!recap) return ctx.error("Sales are still loading.");
      const sale = findReceipt(receipt) ?? (receipt ? undefined : recap.sales.at(-1));
      if (!sale) return ctx.error(receipt ? `No receipt ${receipt} on this stand.` : "This stand has no receipts yet.");
      return ctx.success(JSON.stringify({
        receipt: receiptRef(sale.id),
        status: sale.status,
        paidAt: sale.paidAt,
        currency,
        capturedCents: Math.round(sale.captured * 100),
        refundedCents: Math.round(sale.refunded * 100),
        paidWithPayPal: sale.hasPayPalReceipt,
        items: recap.lines.filter((line) => line.saleId === sale.id).map((line) => ({
          item: line.item,
          units: line.status === "Refunded" ? line.refundedUnits : line.quantity,
          cents: Math.round((line.status === "Refunded" ? line.refunded : line.lineTotal) * 100),
        })),
      }));
    },
  });

  const refund = api.defineAiTool({
    name: "start_refund",
    description: "Open a paid receipt at its refund confirmation so the seller can refund it in full. This does not refund anything: the seller must tap Yes, refund it. Pass the receipt reference, or leave it out for the receipt the seller selected.",
    params: (s) => s.object({ receipt: receiptParam(s).optional() }),
    execute: ({ receipt }, ctx) => {
      const sale = findReceipt(receipt);
      if (!sale) return ctx.error(receipt ? `No receipt ${receipt} on this stand.` : "Name the receipt to refund.");
      if (sale.status !== "Paid") return ctx.error(`Receipt ${receiptRef(sale.id)} is already refunded.`);
      startRefund(sale.id);
      return ctx.success(JSON.stringify({
        receipt: receiptRef(sale.id),
        totalCents: Math.round(sale.total * 100),
        currency,
        state: "Waiting for the seller to confirm. Nothing has been refunded yet.",
      }));
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
            "For item sales use the sum of lines.lineTotal, after deals. For units use the sum of lines.quantity. Keep captured basket totals (sales.total) at receipt grain. Preserve ties and do not infer profit or stock from sales. Tools give amounts in integer cents: tell the seller amounts as money, like $50.00, never in cents.",
            "Refunds are full. A refunded receipt keeps its row with status Refunded and counts 0 toward net totals, units and item sales. For refund questions use sales.refunded, lines.refundedUnits and lines.refunded, or refundCount and refundedCents from the summary. You can't refund anything yourself. When the seller asks to refund a receipt, use start_refund to open its confirmation, then tell them to check it and tap Yes, refund it. Use look_up_receipt to see whether a receipt is Paid or Refunded before saying whether a refund went through, and never start a refund for a receipt that is already Refunded. Only start a refund the seller asked for.",
            checkReceipt && "Use check_paypal_receipt when asked to check a receipt with PayPal or explain its fees. For the latest sale, find its reference with look_up_receipt first. Report the returned capture status, whether the amount and currency match, and any available fee and net at capture. Net at capture is before refunds and is not profit or a payout. Treat null values as unavailable. If the lookup fails, explain that PayPal could not verify it. Do not substitute dashboard totals or invent values.",
            "When the seller asks to add a chart, make the requested canvas change using Studio's tools or delegate to its widget specialist. Preserve existing widgets unless the seller asks to replace them.",
          ].join("\n"),
          tools: (ctx, params) => [summarize, lookUp, refund, ...(checkReceipt ? [checkReceipt] : []), ...(lead.tools?.(ctx, params) ?? [])],
        }),
        ...[builtIn.data, builtIn.page, builtIn.planning, builtIn.widget].map((agent) =>
          directLlmRunner({ ...agent, adapter: claudeAdapter }),
        ),
      ],
      primary: "lead",
      promptStarters: [
        ...(checkReceipt ? [{ label: "Check selected receipt", prompt: "Check my selected receipt with PayPal. What did PayPal capture, and what was the net after fees at capture?" }] : []),
        ...(checkReceipt ? [{ label: "Check my latest sale", prompt: "Check my most recent PayPal receipt with PayPal. Did the capture match the receipt, and what did PayPal keep in fees?" }] : []),
        { label: "Compare my leaders", prompt: "Use the stand summary to compare my top item by units and my top item by sales." },
        { label: "Chart sales by item", prompt: "Add a column chart titled Sales by item. Use Items sold → Item for the categories and sum of Items sold → Item sales for the values. Keep my existing units chart. Tell me which item led by sales." },
        { label: "What did refunds cost?", prompt: "Use the stand summary to tell me how many sales I refunded and how much went back, then which items were refunded using Items sold → Units refunded." },
        { label: "Chart deals", prompt: "Add a chart of deal savings by item using sum of Items sold → Deal savings." },
      ],
    };
  });
}
