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
