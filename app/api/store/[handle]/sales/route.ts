import { z } from "zod";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { CartError } from "@/lib/sales";
import { priceOnlineOrder } from "@/lib/storefront";
import { kindOf } from "@/lib/stands";
import { store } from "@/lib/store";
import type { Sale } from "@/lib/types";

// Anyone on the internet can open an order here, so keep each address to a handful a minute.
const allow = createRateLimiter({ limit: 12, windowMs: 60_000 });

const OrderSchema = z.object({
  cart: z
    .array(z.object({ itemId: z.string().min(1).max(80), quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(24),
  method: z.enum(["pickup", "ship"]),
});

// Opens an online order and hands back its sale id. The buyer pays on the usual /pay page.
export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  if (!allow(clientKey(request))) {
    return Response.json({ error: "Too many orders at once. Wait a minute and try again." }, { status: 429 });
  }
  const parsed = OrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Your cart couldn’t be read. Reload and try again." }, { status: 400 });

  const { handle } = await params;
  const storefront = await store.getStorefrontBySlug(handle);
  const stand = storefront ? await store.getStand(storefront.standId) : null;
  if (!storefront || !stand || kindOf(stand) !== "online") return Response.json({ error: "not found" }, { status: 404 });

  try {
    const order = priceOnlineOrder(stand, storefront, parsed.data.cart, parsed.data.method);
    const sale: Sale = {
      id: crypto.randomUUID(),
      standId: stand.id,
      currency: stand.currency,
      lines: order.lines,
      totalCents: order.totalCents,
      status: "open",
      paypalOrderId: null,
      paypalCaptureId: null,
      createdAt: new Date().toISOString(),
      paidAt: null,
      channel: "online",
      shippingCents: order.shippingCents,
      fulfillment: order.fulfillment,
    };
    await store.saveSale(sale);
    return Response.json({ saleId: sale.id }, { status: 201 });
  } catch (error) {
    if (error instanceof CartError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
