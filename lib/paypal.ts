import "server-only";
import { env } from "./env";
import { fromPayPalValue, toPayPalValue } from "./money";
import type { Sale } from "./types";

// Orders v2 REST API over plain fetch. https://developer.paypal.com/docs/api/orders/v2/

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const basic = Buffer.from(`${env.paypalClientId()}:${env.paypalClientSecret()}`).toString("base64");
  const res = await fetch(`${env.paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

async function paypalFetch<T>(path: string, init: { method: string; body?: unknown; requestId?: string }): Promise<T> {
  const res = await fetch(`${env.paypalApiBase()}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      // Makes retries idempotent: PayPal returns the original result for a repeated request id.
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const debugId = res.headers.get("paypal-debug-id");
    throw new PayPalError(res.status, debugId, json);
  }
  return json as T;
}

export class PayPalError extends Error {
  constructor(
    readonly status: number,
    readonly debugId: string | null,
    readonly body: unknown,
  ) {
    super(`PayPal request failed with ${status}${debugId ? ` (debug id ${debugId})` : ""}`);
  }
}

type Amount = { currency_code: string; value: string };

type Order = {
  id: string;
  status: string;
  purchase_units: {
    reference_id?: string;
    payments?: { captures?: { id: string; status: string; amount: Amount }[] };
  }[];
};

/**
 * `checkoutUrl` is the buyer page; PayPal returns there after a redirect approval or cancel.
 * `brandName` is what PayPal shows the buyer as the seller, instead of the account's business name.
 */
export async function createOrder(sale: Sale, checkoutUrl: string, brandName: string): Promise<{ id: string }> {
  const itemTotal = sale.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const discount = sale.lines.reduce((sum, line) => sum + (line.discountCents ?? 0), 0);
  if (itemTotal - discount !== sale.totalCents) throw new Error(`Sale ${sale.id} lines don't add up to its total`);
  const order = await paypalFetch<Order>("/v2/checkout/orders", {
    method: "POST",
    requestId: `create-${sale.id}`,
    body: {
      intent: "CAPTURE",
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: brandName.slice(0, 127),
            return_url: checkoutUrl,
            cancel_url: checkoutUrl,
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
          },
        },
      },
      purchase_units: [
        {
          reference_id: sale.id,
          amount: {
            currency_code: sale.currency,
            value: toPayPalValue(sale.totalCents),
            // PayPal checks that amount = item_total − discount, so deals go in as a discount, not lower unit prices.
            breakdown: {
              item_total: { currency_code: sale.currency, value: toPayPalValue(itemTotal) },
              ...(discount > 0 ? { discount: { currency_code: sale.currency, value: toPayPalValue(discount) } } : {}),
            },
          },
          items: sale.lines.map((line) => ({
            name: line.name.slice(0, 127),
            quantity: String(line.quantity),
            unit_amount: { currency_code: sale.currency, value: toPayPalValue(line.unitPriceCents) },
          })),
        },
      ],
    },
  });
  return { id: order.id };
}

export type CaptureResult =
  | { ok: true; captureId: string }
  | { ok: false; reason: string };

/** Captures the order and checks the result matches the sale before anyone calls it paid. */
export async function captureOrder(sale: Sale, orderId: string): Promise<CaptureResult> {
  const order = await paypalFetch<Order>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    requestId: `capture-${sale.id}`,
    body: {},
  });
  return verifyCapture(sale, order);
}

export function verifyCapture(sale: Sale, order: Order): CaptureResult {
  if (order.status !== "COMPLETED") return { ok: false, reason: `order status ${order.status}` };
  const unit = order.purchase_units.find((u) => u.reference_id === sale.id) ?? order.purchase_units[0];
  const capture = unit?.payments?.captures?.[0];
  if (!capture) return { ok: false, reason: "no capture on order" };
  if (capture.status !== "COMPLETED") return { ok: false, reason: `capture status ${capture.status}` };
  if (capture.amount.currency_code !== sale.currency) return { ok: false, reason: "currency mismatch" };
  if (fromPayPalValue(capture.amount.value) !== sale.totalCents) return { ok: false, reason: "amount mismatch" };
  return { ok: true, captureId: capture.id };
}
