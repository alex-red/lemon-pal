import { getOrCreateDemoStand } from "@/lib/demo";
import { CartError, priceCart, publicSale, type CartEntry } from "@/lib/sales";
import { store } from "@/lib/store";
import type { Sale } from "@/lib/types";

// Creates a sale from the register's cart. Prices come from the stored catalog.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { cart?: CartEntry[] } | null;
  if (!Array.isArray(body?.cart)) return Response.json({ error: "cart is required" }, { status: 400 });

  // Single demo stand until stand management exists.
  const stand = await getOrCreateDemoStand();
  try {
    const { lines, totalCents } = priceCart(stand, body.cart);
    const sale: Sale = {
      id: crypto.randomUUID(),
      standId: stand.id,
      currency: stand.currency,
      lines,
      totalCents,
      status: "open",
      paypalOrderId: null,
      paypalCaptureId: null,
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    await store.saveSale(sale);
    return Response.json(publicSale(sale), { status: 201 });
  } catch (error) {
    if (error instanceof CartError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
