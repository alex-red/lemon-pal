import { captureOrder, PayPalError } from "@/lib/paypal";
import { publicSale } from "@/lib/sales";
import { store } from "@/lib/store";

// Called by PayPal's onApprove callback on the buyer's phone.
// The sale becomes paid only after PayPal reports a completed capture for the expected amount and currency.
export async function POST(_request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const sale = await store.getSale(saleId);
  if (!sale) return Response.json({ error: "not found" }, { status: 404 });

  // A repeated capture call returns the existing result and never records a second payment.
  if (sale.status === "paid") return Response.json(publicSale(sale));
  if (sale.status !== "open" || !sale.paypalOrderId) {
    return Response.json({ error: "sale has no open PayPal order" }, { status: 409 });
  }

  try {
    const result = await captureOrder(sale, sale.paypalOrderId);
    if (!result.ok) return Response.json({ error: `capture not accepted: ${result.reason}` }, { status: 402 });
    sale.status = "paid";
    sale.paypalCaptureId = result.captureId;
    sale.paidAt = new Date().toISOString();
    await store.saveSale(sale);
    return Response.json(publicSale(sale));
  } catch (error) {
    if (error instanceof PayPalError) {
      console.error(error.message);
      return Response.json({ error: "PayPal capture failed", debugId: error.debugId }, { status: 502 });
    }
    throw error;
  }
}
