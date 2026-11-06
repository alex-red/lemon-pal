import { z } from "zod";
import { buildStickerDemo } from "@/lib/demo-stickers";
import { currentUser } from "@/lib/session";
import { DEMO_USER_ID } from "@/lib/session-token";
import { SlugTakenError, store } from "@/lib/store";

const DemoSchema = z.object({
  // The browser's Date#getTimezoneOffset, so market hours land in the seller's own morning.
  tzOffsetMinutes: z.number().int().min(-14 * 60).max(14 * 60).optional(),
});

// Loads the sticker shop demo into the demo user's two stands: market sales on the local stand, an open store and
// its orders on the online one. Replaces both stands' items, the store settings and every sale. Behind the seller
// passcode. The sales are made up and marked demo, so none of them ever reach PayPal.
export async function POST(request: Request) {
  if ((await currentUser()).id !== DEMO_USER_ID) {
    return Response.json({ error: "The sticker shop demo only loads into the demo stands." }, { status: 403 });
  }
  const parsed = DemoSchema.safeParse(await request.json().catch(() => ({})));
  const demo = await buildStickerDemo({ tzOffsetMinutes: parsed.success ? parsed.data.tzOffsetMinutes : undefined });
  // A store saved on the local stand before stands had kinds would hold the handle. Only the online stand has one now.
  await store.deleteStorefront(demo.local.id);
  try {
    await store.saveStorefront(demo.storefront);
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return Response.json({ error: `Another store already uses /${demo.storefront.slug}.` }, { status: 409 });
    }
    throw error;
  }
  await Promise.all([store.saveStand(demo.local), store.saveStand(demo.online)]);
  await Promise.all([store.clearSales(demo.local.id), store.clearSales(demo.online.id)]);
  await store.saveSales(demo.sales);
  return Response.json({
    slug: demo.storefront.slug,
    items: demo.local.items.length,
    sales: demo.sales.length,
    online: demo.sales.filter((sale) => sale.channel === "online").length,
  });
}
