import { captureOrder, PayPalError } from "@/lib/paypal";
import { publicSale } from "@/lib/sales";
import { store } from "@/lib/store";

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
    const result = await captureOrder(sale, sale.paypalOrderId);
    if (!result.ok) {
      console.error(`Capture for sale ${sale.id} not accepted: ${result.reason}`);
      return Response.json({ error: "PayPal didn't complete the payment." }, { status: 402 });
    }
    // Money moved, so the sale is paid even if the seller canceled it during checkout.
    const paid = await store.updateSale(sale.id, (s) =>
      s.status === "paid"
        ? null
        : { ...s, status: "paid", paypalCaptureId: result.captureId, paidAt: new Date().toISOString() },
    );
    return Response.json(publicSale(paid!));
  } catch (error) {
    if (error instanceof PayPalError) {
      console.error(error.message);
      return Response.json({ error: "PayPal capture failed.", debugId: error.debugId }, { status: 502 });
    }
    throw error;
  }
}
