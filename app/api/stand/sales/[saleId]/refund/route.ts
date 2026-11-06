import { DEMO_STAND_ID } from "@/lib/demo";
import { PayPalError, refundCapture } from "@/lib/paypal";
import { publicSale } from "@/lib/sales";
import { store } from "@/lib/store";

// The seller refunds a paid sale in full, from the recap. Behind the seller passcode, like every /api/stand route.
// The sale becomes refunded only after PayPal accepts the refund for the captured amount and currency.
export async function POST(_request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const sale = await store.getSale(saleId);
  if (!sale || sale.standId !== DEMO_STAND_ID) return Response.json({ error: "not found" }, { status: 404 });

  // A repeated refund returns the existing result and never sends a second one.
  if (sale.status === "refunded") return Response.json(publicSale(sale));
  if (sale.status !== "paid" || !sale.paypalCaptureId) {
    return Response.json({ error: `This sale is ${sale.status === "open" ? "not paid yet" : sale.status}, so there's nothing to refund.` }, { status: 409 });
  }

  // A demo sale never went through PayPal, so there's nothing to send back. It flips locally, like a real refund would.
  if (sale.demo) {
    const refunded = await store.updateSale(sale.id, (s) =>
      s.status === "paid"
        ? { ...s, status: "refunded", refund: { paypalRefundId: `DEMO-REFUND-${s.id.slice(0, 8)}`, refundedAt: new Date().toISOString() } }
        : null,
    );
    return Response.json(publicSale(refunded!));
  }

  try {
    const result = await refundCapture(sale);
    if (!result.ok) {
      console.error(`Refund for sale ${sale.id} not accepted: ${result.reason}`);
      return Response.json({ error: "PayPal didn't accept the refund. The sale is still paid." }, { status: 402 });
    }
    const refunded = await store.updateSale(sale.id, (s) =>
      s.status === "paid"
        ? { ...s, status: "refunded", refund: { paypalRefundId: result.refundId, refundedAt: new Date().toISOString() } }
        : null,
    );
    return Response.json(publicSale(refunded!));
  } catch (error) {
    if (error instanceof PayPalError) {
      console.error(error.message, JSON.stringify(error.body));
      return Response.json({ error: "PayPal couldn't refund this sale. It's still paid, so try again.", debugId: error.debugId }, { status: 502 });
    }
    throw error;
  }
}
