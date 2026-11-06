import "server-only";
import { env } from "./env";
import { fromPayPalValue, toPayPalValue } from "./money";
import type { PostalAddress, Sale, ShippingCarrier } from "./types";

// Orders v2 REST API over plain fetch. https://developer.paypal.com/docs/api/orders/v2/

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function paypalAccessToken(signal?: AbortSignal): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const basic = Buffer.from(`${env.paypalClientId()}:${env.paypalClientSecret()}`).toString("base64");
  const res = await fetch(`${env.paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal,
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
      Authorization: `Bearer ${await paypalAccessToken()}`,
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

type PayPalAddress = {
  address_line_1?: string;
  address_line_2?: string;
  admin_area_2?: string;
  admin_area_1?: string;
  postal_code?: string;
  country_code: string;
};

type Order = {
  id: string;
  status: string;
  payer?: { name?: { given_name?: string; surname?: string } };
  purchase_units: {
    reference_id?: string;
    shipping?: { name?: { full_name?: string }; address?: PayPalAddress };
    payments?: { captures?: { id: string; status: string; amount: Amount; status_details?: { reason?: string } }[] };
  }[];
};

/** Where PayPal says the buyer wants a shipped order sent. */
export type OrderShipping = { recipient?: string; address?: PostalAddress };

function saleUnit(sale: Sale, order: Order) {
  return order.purchase_units.find((u) => u.reference_id === sale.id) ?? order.purchase_units[0];
}

/** The shipping name and address on an order, in our own shape. null when the order has none. */
export function orderShipping(sale: Sale, order: Order): OrderShipping | null {
  const shipping = saleUnit(sale, order)?.shipping;
  if (!shipping) return null;
  const a = shipping.address;
  return {
    recipient: shipping.name?.full_name?.trim() || undefined,
    address: a
      ? {
          line1: a.address_line_1 ?? "",
          ...(a.address_line_2 ? { line2: a.address_line_2 } : {}),
          city: a.admin_area_2 ?? "",
          ...(a.admin_area_1 ? { region: a.admin_area_1 } : {}),
          ...(a.postal_code ? { postalCode: a.postal_code } : {}),
          country: a.country_code,
        }
      : undefined,
  };
}

function payerName(order: Order): string | undefined {
  const name = [order.payer?.name?.given_name, order.payer?.name?.surname].filter(Boolean).join(" ").trim();
  return name || undefined;
}

/**
 * `checkoutUrl` is the buyer page; PayPal returns there after a redirect approval or cancel.
 * `brandName` is what PayPal shows the buyer as the seller, instead of the account's business name.
 */
export async function createOrder(sale: Sale, checkoutUrl: string, brandName: string): Promise<{ id: string }> {
  const itemTotal = sale.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const discount = sale.lines.reduce((sum, line) => sum + (line.discountCents ?? 0), 0);
  const shipping = sale.shippingCents ?? 0;
  if (itemTotal - discount + shipping !== sale.totalCents) throw new Error(`Sale ${sale.id} lines don't add up to its total`);
  const ships = sale.fulfillment?.method === "ship";
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
            // Only funding that settles now. A bank transfer (eCheck) leaves the capture pending for days, and the
            // buyer walks away from the stand unsure they've paid.
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            // A shipped order asks the buyer for an address in PayPal. Everything else never shows one.
            shipping_preference: ships ? "GET_FROM_FILE" : "NO_SHIPPING",
          },
        },
      },
      purchase_units: [
        {
          reference_id: sale.id,
          amount: {
            currency_code: sale.currency,
            value: toPayPalValue(sale.totalCents),
            // PayPal checks that amount = item_total − discount + shipping, so deals go in as a discount, not lower unit prices.
            breakdown: {
              item_total: { currency_code: sale.currency, value: toPayPalValue(itemTotal) },
              ...(discount > 0 ? { discount: { currency_code: sale.currency, value: toPayPalValue(discount) } } : {}),
              ...(ships ? { shipping: { currency_code: sale.currency, value: toPayPalValue(shipping) } } : {}),
            },
          },
          items: sale.lines.map((line) => ({
            name: line.name.slice(0, 127),
            quantity: String(line.quantity),
            unit_amount: { currency_code: sale.currency, value: toPayPalValue(line.unitPriceCents) },
            // A gift, not goods, so PayPal shows it as one and never asks about delivery.
            ...(sale.channel === "donation" ? { category: "DONATION" } : {}),
          })),
        },
      ],
    },
  });
  return { id: order.id };
}

export type CaptureResult =
  | { ok: true; captureId: string; shipping: OrderShipping | null; payerName?: string }
  /** PayPal took the payment but hasn't finished moving the money, as with an eCheck. Not paid yet, and not to be retried. */
  | { ok: false; pending: true; captureId: string; reason: string }
  | { ok: false; pending?: false; reason: string };

/** Reads an order, so the capture route can check a shipping address before any money moves. */
export async function getOrder(orderId: string): Promise<Order> {
  return paypalFetch<Order>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

/** Captures the order and checks the result matches the sale before anyone calls it paid. */
export async function captureOrder(sale: Sale, orderId: string): Promise<CaptureResult> {
  const order = await paypalFetch<Order>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    requestId: `capture-${sale.id}`,
    body: {},
  });
  return verifyCapture(sale, order);
}

/** Reads an order that may already be captured, to finish a sale without capturing twice. */
export async function checkCapture(sale: Sale, orderId: string): Promise<CaptureResult> {
  return verifyCapture(sale, await getOrder(orderId));
}

export function verifyCapture(sale: Sale, order: Order): CaptureResult {
  if (order.status !== "COMPLETED") return { ok: false, reason: `order status ${order.status}` };
  const capture = saleUnit(sale, order)?.payments?.captures?.[0];
  if (!capture) return { ok: false, reason: "no capture on order" };
  if (capture.amount.currency_code !== sale.currency) return { ok: false, reason: "currency mismatch" };
  if (fromPayPalValue(capture.amount.value) !== sale.totalCents) return { ok: false, reason: "amount mismatch" };
  if (capture.status === "PENDING") {
    return { ok: false, pending: true, captureId: capture.id, reason: capture.status_details?.reason ?? "PENDING" };
  }
  if (capture.status !== "COMPLETED") return { ok: false, reason: `capture status ${capture.status}` };
  return { ok: true, captureId: capture.id, shipping: orderShipping(sale, order), payerName: payerName(order) };
}

/**
 * Adds a tracking number to a captured order, so the buyer sees it in PayPal and the seller's shipment counts
 * toward PayPal Seller Protection. https://developer.paypal.com/docs/api/orders/v2/#orders_track_create
 */
export async function addTracking(
  sale: Sale,
  shipment: { tracking: string; carrier: ShippingCarrier; carrierName?: string },
): Promise<void> {
  if (!sale.paypalOrderId || !sale.paypalCaptureId) throw new Error(`Sale ${sale.id} has no capture to track`);
  await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(sale.paypalOrderId)}/track`, {
    method: "POST",
    requestId: `track-${sale.id}-${shipment.tracking}`.slice(0, 108),
    body: {
      capture_id: sale.paypalCaptureId,
      tracking_number: shipment.tracking,
      carrier: shipment.carrier,
      ...(shipment.carrier === "OTHER" && shipment.carrierName ? { carrier_name_other: shipment.carrierName } : {}),
      notify_payer: true,
    },
  });
}

type Refund = { id: string; status: string; amount?: Amount };

export type RefundResult = { ok: true; refundId: string } | { ok: false; reason: string };

/**
 * Refunds the whole capture. Sending no amount refunds all of it, so the server never trusts a client figure.
 * The request id is tied to the sale, so a retried or double-tapped refund returns the first refund instead of a second.
 * https://developer.paypal.com/docs/api/payments/v2/#captures_refund
 */
export async function refundCapture(sale: Sale): Promise<RefundResult> {
  if (!sale.paypalCaptureId) return { ok: false, reason: "no capture to refund" };
  const refund = await paypalFetch<Refund>(`/v2/payments/captures/${encodeURIComponent(sale.paypalCaptureId)}/refund`, {
    method: "POST",
    requestId: `refund-${sale.id}`,
    body: { note_to_payer: "Refunded by the seller through Lemon Pal." },
  });
  return verifyRefund(sale, refund);
}

export function verifyRefund(sale: Sale, refund: Refund): RefundResult {
  // PENDING means PayPal accepted it and will finish moving the money, for example from an eCheck.
  if (refund.status !== "COMPLETED" && refund.status !== "PENDING") return { ok: false, reason: `refund status ${refund.status}` };
  if (refund.amount) {
    if (refund.amount.currency_code !== sale.currency) return { ok: false, reason: "currency mismatch" };
    if (fromPayPalValue(refund.amount.value) !== sale.totalCents) return { ok: false, reason: "amount mismatch" };
  }
  return { ok: true, refundId: refund.id };
}
