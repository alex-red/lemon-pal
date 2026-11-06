import { z } from "zod";
import { loadFundraiser, loadStickerShop } from "@/lib/demo";
import { kindOf } from "@/lib/stands";
import { currentUser, rememberStand, requestStand, standNotFound } from "@/lib/session";
import { SlugTakenError } from "@/lib/store";

const DemoSchema = z.object({
  // The browser's Date#getTimezoneOffset, so market hours land in the seller's own morning.
  tzOffsetMinutes: z.number().int().min(-14 * 60).max(14 * 60).optional(),
});

// Loads a demo into a demo account. From a donation stand, it's the fundraiser: its page and three weeks of gifts.
// From any other stand, it's the sticker shop: market sales on its stand at events (the ?stand= one if it's local),
// an open store and its orders on its online store. Replaces both stands' items, the store settings and every sale.
// Demo accounts only, since the sales are made up: they're marked demo, so none of them ever reach PayPal.
export async function POST(request: Request) {
  const [user, stand] = await Promise.all([currentUser(), requestStand(request)]);
  if (!user.demo) {
    return Response.json({ error: "Demos only load into demo accounts." }, { status: 403 });
  }
  if (!stand) return standNotFound();
  const parsed = DemoSchema.safeParse(await request.json().catch(() => ({})));
  const tzOffsetMinutes = parsed.success ? parsed.data.tzOffsetMinutes : undefined;
  if (kindOf(stand) === "donation") {
    const demo = await loadFundraiser(user, { tzOffsetMinutes, prefer: stand });
    await rememberStand(stand.id);
    return Response.json({ slug: demo.storefront.slug, sales: demo.sales.length });
  }
  try {
    const demo = await loadStickerShop(user, {
      tzOffsetMinutes,
      prefer: stand,
    });
    await rememberStand(stand.id);
    return Response.json({
      slug: demo.storefront.slug,
      items: demo.local.items.length,
      sales: demo.sales.length,
      online: demo.sales.filter((sale) => sale.channel === "online").length,
    });
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return Response.json({ error: `Another store already uses /${error.message}.` }, { status: 409 });
    }
    throw error;
  }
}
