import "server-only";
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
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new CartError("Invalid quantity");
    return { itemId, name: item.name, unitPriceCents: item.priceCents, quantity };
  });
  const totalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  return { lines, totalCents };
}

/** The fields the buyer's phone and the seller's tablet may see. */
export function publicSale(sale: Sale) {
  const { id, currency, lines, totalCents, status, paidAt } = sale;
  return { id, currency, lines, totalCents, status, paidAt };
}
export type PublicSale = ReturnType<typeof publicSale>;
