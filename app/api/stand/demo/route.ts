import { z } from "zod";
import { buildStickerDemo } from "@/lib/demo-stickers";
import { SlugTakenError, store } from "@/lib/store";

const DemoSchema = z.object({
  // The browser's Date#getTimezoneOffset, so market hours land in the seller's own morning.
  tzOffsetMinutes: z.number().int().min(-14 * 60).max(14 * 60).optional(),
});

// Loads the sticker shop demo: replaces the stand, its storefront and all its sales. Behind the seller passcode.
// The sales are made up and marked demo, so none of them ever reach PayPal.
export async function POST(request: Request) {
  const parsed = DemoSchema.safeParse(await request.json().catch(() => ({})));
  const demo = await buildStickerDemo({ tzOffsetMinutes: parsed.success ? parsed.data.tzOffsetMinutes : undefined });
  try {
    await store.saveStorefront(demo.storefront);
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return Response.json({ error: `Another store already uses /${demo.storefront.slug}.` }, { status: 409 });
    }
    throw error;
  }
  await store.saveStand(demo.stand);
  await store.clearSales(demo.stand.id);
  await store.saveSales(demo.sales);
  return Response.json({
    slug: demo.storefront.slug,
    items: demo.stand.items.length,
    sales: demo.sales.length,
    online: demo.sales.filter((sale) => sale.channel === "online").length,
  });
}
