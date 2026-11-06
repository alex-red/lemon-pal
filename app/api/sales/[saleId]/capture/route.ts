import { captureOrder, getOrder, orderShipping, PayPalError, verifyCapture } from "@/lib/paypal";
import { publicSale } from "@/lib/sales";
import { countryName } from "@/lib/shipping";
import { store } from "@/lib/store";
import type { Fulfillment, Sale } from "@/lib/types";

/**
 * A shipped order is checked before capture: if the buyer picked an address the seller doesn't ship to, nothing
 * is charged and they can choose another. Returns the error message, or null when the order can go ahead.
 */
async function shippingProblem(sale: Sale, order: Awaited<ReturnType<typeof getOrder>>): Promise<string | null> {
  if (sale.fulfillment?.method !== "ship") return null;
  const storefront = await store.getStorefront(sale.standId);
  const shipping = orderShipping(sale, order);
  const country = shipping?.address?.country;
  if (!country) return "PayPal didn’t send a shipping address. Please try again and choose one.";
  const countries = storefront?.shipping.countries ?? [];
  if (!countries.includes(country)) {
    const where = countries.map((code) => countryName(code, "en")).join(", ");
    return `This store doesn’t ship to ${countryName(country, "en")}${where ? `. It ships to ${where}` : ""}. Go back to the store to try another address or pickup.`;
  }
  return null;
}

// Called from the PayPal session's onApprove on the buyer's phone.
// The sale becomes paid only after PayPal reports a completed capture for the expected amount and currency.
export async function POST(_request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const sale = await store.getSale(saleId);
  if (!sale) return Response.json({ error: "not found" }, { status: 404 });

  // A repeated capture call returns the existing result and never records a second payment.
  if (sale.status === "paid") return Response.json(publicSale(sale));
  if (sale.status !== "open" || !sale.paypalOrderId) {
    return Response.json({ error: `This sale is ${sale.status} and can't be paid.` }, { status: 409 });
  }

  try {
    const order = await getOrder(sale.paypalOrderId);
    let result;
    if (order.status === "COMPLETED") {
      // Already captured, by an earlier call that came back pending: read the result instead of capturing again.
      result = verifyCapture(sale, order);
    } else {
      const problem = await shippingProblem(sale, order);
      if (problem) {
        // The approved order is tied to that address, so this sale can't be paid. The buyer starts again from the store.
        await store.updateSale(sale.id, (s) => (s.status === "open" ? { ...s, status: "canceled" } : null));
        return Response.json({ error: problem, restart: true }, { status: 422 });
      }
      result = await captureOrder(sale, sale.paypalOrderId);
    }

    if (!result.ok && result.pending) {
      // The money is on its way but hasn't arrived. Not paid yet, and the buyer mustn't pay a second time.
      const { captureId, reason } = result;
      await store.updateSale(sale.id, (s) =>
        s.status === "open" && !s.pendingCapture
          ? { ...s, paypalCaptureId: captureId, pendingCapture: { captureId, reason, since: new Date().toISOString() } }
          : null,
      );
      return Response.json({ pending: true, reason }, { status: 202 });
    }
    if (!result.ok) {
      console.error(`Capture for sale ${sale.id} not accepted: ${result.reason}`);
      return Response.json({ error: "PayPal didn't complete the payment." }, { status: 402 });
    }
    // Money moved, so the sale is paid even if the seller canceled it during checkout.
    const paid = await store.updateSale(sale.id, (s) => {
      if (s.status === "paid") return null;
      // Keep the address PayPal actually captured with, not what the buyer had before approving.
      const fulfillment: Fulfillment | undefined =
        s.fulfillment?.method === "ship"
          ? { ...s.fulfillment, recipient: result.shipping?.recipient, address: result.shipping?.address }
          : s.fulfillment;
      const { pendingCapture, ...rest } = s;
      void pendingCapture;
      return {
        ...rest,
        status: "paid",
        paypalCaptureId: result.captureId,
        paidAt: new Date().toISOString(),
        ...(fulfillment ? { fulfillment } : {}),
        // The seller sees whose order or gift it is. Never sent to a public route.
        ...((s.channel === "online" || s.channel === "donation") && result.payerName ? { buyerName: result.payerName } : {}),
      };
    });
    return Response.json(publicSale(paid!));
  } catch (error) {
    if (error instanceof PayPalError) {
      console.error(error.message);
      return Response.json({ error: "PayPal capture failed.", debugId: error.debugId }, { status: 502 });
    }
    throw error;
  }
}
