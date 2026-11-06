/** Amounts are integer minor units (cents) everywhere except at the PayPal boundary. */
export type Cents = number;

export function toPayPalValue(cents: Cents): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`Invalid amount in cents: ${cents}`);
  }
  return (cents / 100).toFixed(2);
}

export function fromPayPalValue(value: string): Cents {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error(`Unexpected PayPal amount: ${value}`);
  }
  const [whole, frac = ""] = value.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatMoney(cents: Cents, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

/** Cents as a seller types them: 5 or 5.50, without trailing zeros. Blank for null. */
export function centsText(cents: Cents | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2).replace(/\.00$/, "");
}

/** "5", "5.50" or "$5" in cents. Blank is null; anything else unreadable is NaN. */
export function parseCents(text: string): Cents | null {
  const clean = text.replace(/[^\d.]/g, "");
  if (!text.trim()) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return NaN;
  return Math.round(Number(clean) * 100);
}

/** The currency's own mark, such as $ or €, for a price field's prefix. */
export function currencyMark(currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).formatToParts(0).find((part) => part.type === "currency")?.value ?? "$";
}
