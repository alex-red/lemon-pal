import { lineTotalCents } from "./deals";
import type { Sale } from "./types";

// Row shapes for the AG Studio recap. Amounts are in currency units because Studio formats them as money.
export type RecapSaleRow = {
  id: string;
  paidAt: string;
  /** What the buyer paid, shipping included. */
  total: number;
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
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** What a deal took off this line. 0 when none applied. */
  discount: number;
  paidAt: string;
};
export type RecapData = {
  sales: RecapSaleRow[];
  lines: RecapLineRow[];
  /** Seconds from the sign read to the first paid sale on the published catalog, once there is one. */
  firstSaleSeconds?: number | null;
};

/** Only verified, captured sales count. Each sale appears once, keyed by its id. */
export function toRecap(sales: Sale[]): RecapData {
  const paid = sales
    .filter((s): s is Sale & { paidAt: string } => s.status === "paid" && s.paidAt !== null)
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  return {
    sales: paid.map((s) => ({
      id: s.id,
      paidAt: s.paidAt,
      total: s.totalCents / 100,
      units: s.lines.reduce((n, l) => n + l.quantity, 0),
      currency: s.currency,
      channel: s.channel === "online" ? "Online" : "Stand",
      shipping: (s.shippingCents ?? 0) / 100,
    })),
    lines: paid.flatMap((s) =>
      s.lines.map((l) => ({
        id: `${s.id}:${l.itemId}`,
        saleId: s.id,
        item: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPriceCents / 100,
        lineTotal: lineTotalCents(l) / 100,
        discount: (l.discountCents ?? 0) / 100,
        paidAt: s.paidAt,
      })),
    ),
  };
}
