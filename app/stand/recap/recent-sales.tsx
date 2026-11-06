"use client";

import type { AgWidgetFieldReference, AgWidgetParams } from "ag-studio";
import { AgIncompleteDataMappingOverlay } from "ag-studio-react";
import { createContext, use, useState } from "react";
import { ArrowUturnIcon, Button, ChevronRightIcon, Money, SaleStatusPill, Sheet, cn } from "@/components/kit";
import type { RecapData, RecapLineRow, RecapSaleRow } from "@/lib/recap";
import { receiptRef, receiptTime } from "./recap-metrics";
import { RecapCurrency } from "./recap-widgets";

/** Lets widgets inside Studio open a receipt. The sheet itself renders outside Studio, so Studio never sees its events. */
export const RecapActions = createContext<{ openReceipt: (saleId: string) => void } | null>(null);

export interface RecentSalesDef {
  type: "recentSales";
  dataMapping: Record<"sale" | "paidAt" | "captured" | "status", AgWidgetFieldReference[]>;
}

const cents = (amount: unknown) => Math.round(Number(amount) * 100);

/** The latest receipts as tappable rows. A tap opens the receipt, where the seller can refund it. */
export function RecentSalesWidget({ widgetApi, dataMapping }: AgWidgetParams<RecentSalesDef>) {
  const currency = use(RecapCurrency);
  const actions = use(RecapActions);
  const sale = dataMapping.sale?.at(0);
  const paidAt = dataMapping.paidAt?.at(0);
  const captured = dataMapping.captured?.at(0);
  const status = dataMapping.status?.at(0);
  if (!sale || !paidAt || !captured || !status) return <AgIncompleteDataMappingOverlay />;

  const { results } = use(widgetApi.getData(
    { fields: [sale, paidAt, status, captured], sort: [{ field: paidAt, direction: "desc" }] },
    { queryId: "recent-sales" },
  ));
  const rows = results.rows;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-headline font-semibold">Recent sales</p>
        {rows.length > 0 && <p className="text-caption text-ink-2">Tap one to refund</p>}
      </div>
      {rows.length === 0 ? (
        <p className="text-subhead text-ink-2">Payments show here as they clear, newest first.</p>
      ) : (
        <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto">
          {rows.map((row) => {
            const id = String(row[sale.key]);
            const refunded = row[status.key] === "Refunded";
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => actions?.openReceipt(id)}
                  aria-label={`Receipt ${receiptRef(id)}, ${refunded ? "refunded" : "paid"}. Open to see items${refunded ? "" : " or refund"}.`}
                  className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-field px-1 py-1.5 text-left hover:bg-fill-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-footnote font-semibold">{receiptRef(id)}</span>
                    <span className="block whitespace-nowrap text-caption text-ink-2">{receiptTime.format(new Date(row[paidAt.key]))}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Money cents={cents(row[captured.key])} currency={currency} className={cn(refunded && "text-ink-2 line-through decoration-ink-3")} />
                    {/* Keyed on status, so the pill rises in again when a sale flips to refunded. */}
                    <span key={String(row[status.key])} className="animate-rise">
                      <SaleStatusPill status={refunded ? "refunded" : "paid"} />
                    </span>
                  </span>
                  <ChevronRightIcon className="shrink-0 text-ink-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type RefundState = { step: "view" | "confirm" | "refunding" | "done" } | { step: "error"; message: string };

/** One receipt, with a two-step refund. Keyed by sale id, so its steps reset for each receipt. */
export function ReceiptSheet({
  saleId,
  shownId,
  recap,
  currency,
  onClose,
  onRefunded,
}: {
  /** The receipt to show, or null to close the sheet. */
  saleId: string | null;
  /** The receipt whose content stays in the sheet while it animates closed. */
  shownId: string;
  recap: RecapData | null;
  currency: string;
  onClose: () => void;
  onRefunded: () => void;
}) {
  const sale = recap?.sales.find((s) => s.id === shownId) ?? null;
  const lines = recap?.lines.filter((l) => l.saleId === shownId) ?? [];
  const [state, setState] = useState<RefundState>({ step: "view" });
  const refunded = sale?.status === "Refunded";
  const capturedCents = sale ? cents(sale.captured) : 0;

  async function refund() {
    if (!sale) return;
    setState({ step: "refunding" });
    try {
      const res = await fetch(`/api/stand/sales/${encodeURIComponent(sale.id)}/refund`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "PayPal couldn't refund this sale. It's still paid, so try again.");
      setState({ step: "done" });
      onRefunded();
    } catch (error) {
      setState({ step: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  // Closing mid-refund would hide the result, so the sheet stays until PayPal answers.
  const close = () => {
    if (state.step !== "refunding") onClose();
  };

  return (
    <Sheet open={saleId !== null} title={sale ? `Receipt ${receiptRef(sale.id)}` : "Receipt"} onClose={close}>
      {!sale ? (
        <p className="text-subhead text-ink-2">This receipt isn&rsquo;t in today&rsquo;s sales any more.</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-subhead text-ink-2">
              {sale.channel === "Online" ? "Online order" : "At the stand"} · {receiptTime.format(new Date(sale.paidAt))}
            </p>
            <span key={sale.status} className="animate-rise">
              <SaleStatusPill status={refunded ? "refunded" : "paid"} />
            </span>
          </div>

          <Receipt sale={sale} lines={lines} currency={currency} />

          {state.step === "done" || (refunded && state.step === "view") ? (
            <RefundedNote cents={capturedCents} currency={currency} fresh={state.step === "done"} onClose={onClose} />
          ) : state.step === "view" ? (
            <div className="flex flex-col gap-2">
              <Button variant="destructive" size="lg" icon={<ArrowUturnIcon />} onClick={() => setState({ step: "confirm" })}>
                Refund <Money cents={capturedCents} currency={currency} />
              </Button>
              <p className="text-center text-footnote text-ink-2">Sends the full amount back to the buyer&rsquo;s PayPal.</p>
            </div>
          ) : (
            <div className="flex animate-rise flex-col gap-3 rounded-field bg-berry-soft p-4" role="alertdialog" aria-labelledby="refund-confirm">
              <p id="refund-confirm" className="text-callout">
                <strong className="font-semibold">
                  Refund <Money cents={capturedCents} currency={currency} /> to the buyer?
                </strong>{" "}
                PayPal sends it straight back, and the sale comes off your totals. You can&rsquo;t undo a refund.
              </p>
              {state.step === "error" && (
                <p role="alert" className="text-footnote font-semibold text-berry">
                  {state.message}
                </p>
              )}
              <div className="flex flex-wrap-reverse justify-end gap-2">
                <Button variant="plain" disabled={state.step === "refunding"} onClick={() => setState({ step: "view" })}>
                  Keep the sale
                </Button>
                <Button variant="filled" icon={<ArrowUturnIcon />} loading={state.step === "refunding"} onClick={refund}>
                  {state.step === "refunding" ? "Refunding…" : state.step === "error" ? "Try again" : "Yes, refund it"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Receipt({ sale, lines, currency }: { sale: RecapSaleRow; lines: RecapLineRow[]; currency: string }) {
  const refunded = sale.status === "Refunded";
  return (
    <div className="rounded-field bg-fill">
      <ul className="divide-y divide-hairline">
        {lines.map((line) => {
          const units = refunded ? line.refundedUnits : line.quantity;
          const total = refunded ? line.refunded : line.lineTotal;
          return (
            <li key={line.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0 text-callout">
                <span className="font-semibold">{line.item}</span>
                <span className="text-ink-2"> × {units}</span>
              </span>
              <Money cents={cents(total)} currency={currency} />
            </li>
          );
        })}
        {sale.shipping > 0 && (
          <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-callout">
            <span className="text-ink-2">Shipping</span>
            <Money cents={cents(sale.shipping)} currency={currency} />
          </li>
        )}
        <li className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-headline font-semibold">{refunded ? "Refunded" : "Paid with PayPal"}</span>
          <Money cents={cents(sale.captured)} currency={currency} size="title" />
        </li>
      </ul>
    </div>
  );
}

function RefundedNote({ cents: amount, currency, fresh, onClose }: { cents: number; currency: string; fresh: boolean; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center" role="status">
      <span className={cn("grid size-14 place-items-center rounded-full bg-berry-soft text-title2 text-berry", fresh && "animate-pop")}>
        <ArrowUturnIcon />
      </span>
      <p className="text-callout">
        <strong className="font-semibold">
          <Money cents={amount} currency={currency} /> went back to the buyer.
        </strong>{" "}
        <span className="text-ink-2">It&rsquo;s off your stand totals.</span>
      </p>
      {fresh && (
        <Button variant="tinted" onClick={onClose}>
          Done
        </Button>
      )}
    </div>
  );
}
