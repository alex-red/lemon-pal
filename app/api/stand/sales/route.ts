import { CartError, priceCart, publicSale, type CartEntry } from "@/lib/sales";
import { requestStand, standNotFound } from "@/lib/session";
import { kindOf } from "@/lib/stands";
import { store } from "@/lib/store";
import type { Sale } from "@/lib/types";

// Creates a sale from the register's cart, on the local stand the register shows (?stand=). Behind the seller
// passcode, so only the seller rings up sales. Prices come from the stored catalog.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { cart?: CartEntry[] } | null;
  if (!Array.isArray(body?.cart)) return Response.json({ error: "cart is required" }, { status: 400 });

  const stand = await requestStand(request);
  if (!stand) return standNotFound();
  if (kindOf(stand) !== "local") return Response.json({ error: "Only a local stand has a register." }, { status: 409 });
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
