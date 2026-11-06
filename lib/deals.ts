import { formatMoney, type Cents } from "./money";
import type { SaleLine } from "./types";

/** A multi-buy price for one item, read from the sign and confirmed by the seller: "2 for $5". */
export type Deal = { quantity: number; priceCents: Cents };

export const MAX_DEAL_QUANTITY = 99;

/** A deal is usable only when it buys at least two and costs less than buying them one at a time. */
export function isValidDeal(unitPriceCents: Cents, deal: Deal): boolean {
  return (
    Number.isInteger(deal.quantity) &&
    deal.quantity >= 2 &&
    deal.quantity <= MAX_DEAL_QUANTITY &&
    Number.isInteger(deal.priceCents) &&
    deal.priceCents > 0 &&
    deal.priceCents < unitPriceCents * deal.quantity
  );
}

/**
 * What the deal takes off a line. Every full group of `deal.quantity` costs the deal price, and the rest
 * cost the unit price: 5 stickers at $3 with 2 for $5 is $5 + $5 + $3, a $2 saving.
 */
export function dealDiscount(unitPriceCents: Cents, quantity: number, deal: Deal | undefined): Cents {
  if (!deal || !isValidDeal(unitPriceCents, deal)) return 0;
  const groups = Math.floor(quantity / deal.quantity);
  return groups * (unitPriceCents * deal.quantity - deal.priceCents);
}

/** "2 for $5.00", as the sign would say it. */
export function dealLabel(deal: Deal, currency: string): string {
  return `${deal.quantity} for ${formatMoney(deal.priceCents, currency)}`;
}

/** What a sale line costs after its deal. */
export function lineTotalCents(line: SaleLine): Cents {
  return line.unitPriceCents * line.quantity - (line.discountCents ?? 0);
}
