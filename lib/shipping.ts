import type { Cents } from "./money";
import type { ShippingSettings } from "./types";

// Shipping arithmetic, shared so the store page shows the same number the server charges.
// The server always recomputes it from the stored settings; the client's figure is only for display.

export type FulfillmentMethod = "pickup" | "ship";

/** What shipping costs for an order whose items (after deals) come to `subtotalCents`. */
export function shippingCents(settings: ShippingSettings, subtotalCents: Cents): Cents {
  if (settings.freeOverCents !== null && subtotalCents >= settings.freeOverCents) return 0;
  return settings.flatRateCents;
}

/** Country names for the codes the editor offers, in the buyer's language where the browser knows it. */
export function countryName(code: string, locale?: string): string {
  try {
    return new Intl.DisplayNames(locale ? [locale] : undefined, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Parses "US, ca gb" into ["US", "CA", "GB"], dropping anything that isn't two letters. */
export function parseCountries(text: string): string[] {
  const codes = text
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((code) => /^[A-Z]{2}$/.test(code));
  return [...new Set(codes)];
}
