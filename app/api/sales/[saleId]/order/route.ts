import { createOrder } from "@/lib/paypal";
import { store } from "@/lib/store";

// Called by PayPal's createOrder callback on the buyer's phone.
// A retried checkout reuses the sale's existing order instead of creating a second one.
export async function POST(_request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const sale = await store.getSale(saleId);
  if (!sale) return Response.json({ error: "not found" }, { status: 404 });
  if (sale.status !== "open") return Response.json({ error: `sale is ${sale.status}` }, { status: 409 });

  if (!sale.paypalOrderId) {
    const order = await createOrder(sale);
    sale.paypalOrderId = order.id;
    await store.saveSale(sale);
  }
  return Response.json({ orderId: sale.paypalOrderId });
}
