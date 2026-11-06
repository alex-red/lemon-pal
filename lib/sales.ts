import "server-only";
import { dealDiscount, lineTotalCents } from "./deals";
import type { Sale, SaleLine, Stand } from "./types";

export type CartEntry = { itemId: string; quantity: number };

export class CartError extends Error {}

/** Prices a cart from the confirmed catalog only. Client-sent prices are never trusted. */
export function priceCart(stand: Stand, cart: CartEntry[]): { lines: SaleLine[]; totalCents: number } {
  if (!stand.publishedAt) throw new CartError("Stand is not published");
  if (cart.length === 0) throw new CartError("Cart is empty");
  const lines: SaleLine[] = cart.map(({ itemId, quantity }) => {
    const item = stand.items.find((i) => i.id === itemId);
    if (!item) throw new CartError(`Unknown item ${itemId}`);
    if (item.soldOut) throw new CartError(`${item.name} is sold out.`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new CartError("Invalid quantity");
    const discountCents = dealDiscount(item.priceCents, quantity, item.deal);
    return {
      itemId,
      name: item.name,
      emoji: item.emoji,
      unitPriceCents: item.priceCents,
      quantity,
      // Snapshot the deal only when it applied, so the receipt and recap show what the buyer got.
      ...(discountCents > 0 ? { deal: item.deal, discountCents } : {}),
      // And the item's shelf, so the recap can group by it even after the catalog changes.
      ...(item.category ? { category: item.category } : {}),
      ...(item.finish ? { finish: item.finish } : {}),
    };
  });
  const totalCents = lines.reduce((sum, l) => sum + lineTotalCents(l), 0);
  return { lines, totalCents };
}

/** The fields the buyer's phone and the seller's tablet may see. */
export function publicSale(sale: Sale) {
  const { id, currency, lines, totalCents, status, paidAt } = sale;
  const fulfillment = sale.fulfillment;
  return {
    id,
    currency,
    lines,
    totalCents,
    status,
    paidAt,
    refundedAt: sale.refund?.refundedAt ?? null,
    channel: sale.channel ?? "register",
    shippingCents: sale.shippingCents ?? 0,
    method: fulfillment?.method ?? null,
    // Never the street address: the code page is reachable by anyone holding the link. The town is enough to reassure.
    shipTo:
      fulfillment?.method === "ship" && fulfillment.address
        ? [fulfillment.address.city, fulfillment.address.region].filter(Boolean).join(", ")
        : null,
  };
}
export type PublicSale = ReturnType<typeof publicSale> & {
  /** Set when this was the stand's first paid sale since setup: seconds from the sign read to payment. */
  firstSaleSeconds?: number;
};
