import "server-only";
import { lineTotalCents } from "./deals";
import { store } from "./store";
import type { Fulfillment, Sale, SaleLine } from "./types";

/** A paid online order as the seller sees it, address included. Only seller routes, behind the passcode, return these. */
export type SellerOrder = {
  id: string;
  paidAt: string;
  currency: string;
  lines: SaleLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  buyerName?: string;
  fulfillment: Fulfillment;
};

export function toSellerOrder(sale: Sale & { paidAt: string; fulfillment: Fulfillment }): SellerOrder {
  return {
    id: sale.id,
    paidAt: sale.paidAt,
    currency: sale.currency,
    lines: sale.lines,
    subtotalCents: sale.lines.reduce((sum, line) => sum + lineTotalCents(line), 0),
    shippingCents: sale.shippingCents ?? 0,
    totalCents: sale.totalCents,
    buyerName: sale.buyerName,
    fulfillment: sale.fulfillment,
  };
}

/** Paid online orders, newest first. Unpaid and canceled ones never reach the seller's list. */
export async function listSellerOrders(standId: string): Promise<SellerOrder[]> {
  const sales = await store.listSales(standId);
  return sales
    .filter(
      (s): s is Sale & { paidAt: string; fulfillment: Fulfillment } =>
        s.channel === "online" && s.status === "paid" && s.paidAt !== null && s.fulfillment !== undefined,
    )
    .map(toSellerOrder)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

/** How many orders still need the seller: to post, or waiting to be collected. */
export function waitingCount(orders: SellerOrder[]): number {
  return orders.filter((o) => o.fulfillment.status === "to_ship" || o.fulfillment.status === "to_collect").length;
}
