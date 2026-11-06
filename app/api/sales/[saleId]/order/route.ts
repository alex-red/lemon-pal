import { env } from "@/lib/env";
import { createOrder } from "@/lib/paypal";
import { store } from "@/lib/store";

// Called when the buyer taps the PayPal button.
// A retried checkout reuses the sale's existing order instead of creating a second one.
export async function POST(request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const sale = await store.getSale(saleId);
  if (!sale) return Response.json({ error: "not found" }, { status: 404 });
  if (sale.status !== "open") return Response.json({ error: `sale is ${sale.status}` }, { status: 409 });

  if (!sale.paypalOrderId) {
    const origin = env.publicAppUrl() ?? new URL(request.url).origin;
    const stand = await store.getStand(sale.standId);
    // An online order shows the buyer the store's own title in PayPal.
    const storefront = sale.channel === "online" ? await store.getStorefront(sale.standId) : null;
    const order = await createOrder(sale, `${origin}/pay/${sale.id}`, storefront?.title || stand?.name || "Lemon Pal");
    sale.paypalOrderId = order.id;
    await store.saveSale(sale);
  }
  return Response.json({ orderId: sale.paypalOrderId });
}
