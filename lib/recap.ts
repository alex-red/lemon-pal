import { lineTotalCents } from "./deals";
import { countryName } from "./shipping";
import type { Sale } from "./types";

// Row shapes for the AG Studio recap. Amounts are in currency units because Studio formats them as money.
// A refunded sale keeps its row, so the seller sees it flip, but counts as nothing kept: its net fields are 0.
export type RecapStatus = "Paid" | "Refunded";
export type RecapSaleRow = {
  id: string;
  paidAt: string;
  status: RecapStatus;
  /** What the stand kept: the captured total, or 0 once refunded. */
  total: number;
  /** What PayPal captured, shipping included, refunded or not. */
  captured: number;
  /** What went back to the buyer. 0 unless refunded. */
  refunded: number;
  /** Units kept. 0 once refunded. */
  units: number;
  currency: string;
  hasPayPalReceipt: boolean;
  /** "Stand" for the register, "Online" for the store. */
  channel: "Stand" | "Online";
  /** Shipping charged on an online order. 0 otherwise. */
  shipping: number;
  /** How the buyer got it. */
  fulfillment: RecapFulfillment;
  /** Where a shipped order went: country name and state or region. "Not shipped" otherwise. */
  country: string;
  region: string;
  /** 1 for a shipped order, so a chart can count them by place. 0 otherwise. */
  shippedOrders: number;
};
export type RecapFulfillment = "At the stand" | "Pickup" | "Shipped";
export type RecapLineRow = {
  id: string;
  saleId: string;
  item: string;
  status: RecapStatus;
  /** Units kept. 0 once refunded. */
  quantity: number;
  unitPrice: number;
  /** Item sales kept, after deals. 0 once refunded. */
  lineTotal: number;
  /** What a deal took off this line. 0 when none applied or once refunded. */
  discount: number;
  /** Units given back in a refund. */
  refundedUnits: number;
  /** Item sales given back in a refund, after deals. */
  refunded: number;
  paidAt: string;
  /** The item's category and finish when sold. "Other" and "Not set" for items without them. */
  category: string;
  finish: string;
  channel: "Stand" | "Online";
};
export type RecapData = {
  sales: RecapSaleRow[];
  lines: RecapLineRow[];
  /** Seconds from the sign read to the first paid sale on the published catalog, once there is one. */
  firstSaleSeconds?: number | null;
};

/** Only verified, captured sales count, refunded ones included at zero. Each sale appears once, keyed by its id. */
export function toRecap(sales: Sale[]): RecapData {
  const paid = sales
    .filter((s): s is Sale & { paidAt: string } => (s.status === "paid" || s.status === "refunded") && s.paidAt !== null)
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  return {
    sales: paid.map((s) => {
      const refunded = s.status === "refunded";
      const units = s.lines.reduce((n, l) => n + l.quantity, 0);
      return {
      id: s.id,
      paidAt: s.paidAt,
      status: refunded ? "Refunded" : "Paid",
      total: refunded ? 0 : s.totalCents / 100,
      captured: s.totalCents / 100,
      refunded: refunded ? s.totalCents / 100 : 0,
      units: refunded ? 0 : units,
      currency: s.currency,
      hasPayPalReceipt: !s.demo && Boolean(s.paypalOrderId && s.paypalCaptureId),
      channel: s.channel === "online" ? "Online" : "Stand",
      shipping: (s.shippingCents ?? 0) / 100,
      fulfillment: fulfillmentOf(s),
      ...shipTo(s),
      };
    }),
    lines: paid.flatMap((s) => {
      const refunded = s.status === "refunded";
      return s.lines.map((l) => ({
        id: `${s.id}:${l.itemId}`,
        saleId: s.id,
        item: l.name,
        status: refunded ? "Refunded" : "Paid",
        quantity: refunded ? 0 : l.quantity,
        unitPrice: l.unitPriceCents / 100,
        lineTotal: refunded ? 0 : lineTotalCents(l) / 100,
        discount: refunded ? 0 : (l.discountCents ?? 0) / 100,
        refundedUnits: refunded ? l.quantity : 0,
        refunded: refunded ? lineTotalCents(l) / 100 : 0,
        paidAt: s.paidAt,
        category: l.category ?? "Other",
        finish: l.finish ?? "Not set",
        channel: s.channel === "online" ? ("Online" as const) : ("Stand" as const),
      }));
    }),
  };
}

function fulfillmentOf(sale: Sale): RecapFulfillment {
  if (sale.channel !== "online") return "At the stand";
  return sale.fulfillment?.method === "ship" ? "Shipped" : "Pickup";
}

// Country and region only, never the street: the recap goes to the Booth Analyst too.
function shipTo(sale: Sale): { country: string; region: string; shippedOrders: number } {
  const address = sale.fulfillment?.method === "ship" ? sale.fulfillment.address : undefined;
  if (!address) return { country: "Not shipped", region: "Not shipped", shippedOrders: 0 };
  return { country: countryName(address.country, "en"), region: address.region || address.city, shippedOrders: 1 };
}
