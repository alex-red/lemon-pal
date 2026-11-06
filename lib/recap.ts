import { lineTotalCents } from "./deals";
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
  /** "Stand" for the register, "Online" for the store. */
  channel: "Stand" | "Online";
  /** Shipping charged on an online order. 0 otherwise. */
  shipping: number;
};
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
      channel: s.channel === "online" ? "Online" : "Stand",
      shipping: (s.shippingCents ?? 0) / 100,
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
      }));
    }),
  };
}
