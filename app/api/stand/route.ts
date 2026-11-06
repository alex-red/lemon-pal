import { z } from "zod";
import { isValidDeal, MAX_DEAL_QUANTITY } from "@/lib/deals";
import { demoStand, getOrCreateDemoStand, isSampleId } from "@/lib/demo";
import { cleanEmoji } from "@/lib/emoji";
import { store } from "@/lib/store";

const PublishSchema = z.object({
  // Optional: a stand published without a name keeps its current one.
  name: z.string().trim().max(40).optional(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        // The seller confirms every price; nothing unreadable gets through.
        priceCents: z.number().int().min(1).max(100_000),
        emoji: z.string().max(16).optional().transform(cleanEmoji),
        // A thumbnail the setup screen cropped from the seller's photo. Small enough to keep in the stand record.
        image: z
          .string()
          .max(120_000)
          .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
          .optional(),
        deal: z
          .object({
            quantity: z.number().int().min(2).max(MAX_DEAL_QUANTITY),
            priceCents: z.number().int().min(1).max(100_000),
          })
          .optional(),
      })
      // A deal that saves nothing is a typo, not a deal.
      .refine((item) => !item.deal || isValidDeal(item.priceCents, item.deal), {
        message: "A deal has to cost less than buying the items one at a time.",
      }),
    )
    .min(1)
    .max(24),
});

// Publishes the seller's confirmed catalog. Existing sales keep their own line-item snapshots.
export async function POST(request: Request) {
  const parsed = PublishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const dealIssue = parsed.error.issues.find((issue) => issue.code === "custom");
    return Response.json(
      { error: dealIssue?.message ?? "Every item needs a name and a price." },
      { status: 400 },
    );
  }
  const current = await getOrCreateDemoStand();
  const stand = {
    ...current,
    name: parsed.data.name || current.name,
    publishedAt: new Date().toISOString(),
    // The clock runs from the sign read that drafted this catalog. A blank form or an edit without one has none.
    setupStartedAt: current.draftStartedAt ?? null,
    draftStartedAt: null,
    items: parsed.data.items.map((item, i) => {
      // Item ids change on every publish, so the store's online and shipping choices, and the category
      // and finish the recap groups by, follow the item's name.
      const before = current.items.find((old) => old.name.trim().toLowerCase() === item.name.toLowerCase());
      return {
        id: `item-${i + 1}-${Date.now().toString(36)}`,
        ...item,
        ...(before?.online !== undefined ? { online: before.online } : {}),
        ...(before?.ships !== undefined ? { ships: before.ships } : {}),
        ...(before?.category ? { category: before.category } : {}),
        ...(before?.finish ? { finish: before.finish } : {}),
      };
    }),
  };
  await store.saveStand(stand);
  return Response.json(stand);
}

// Loads a sample stand: ?sample=bake-sale, or the lemonade stand by default.
// With ?sales=clear it also deletes the stand's sales, for the judge demo reset.
export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const sample = params.get("sample");
  const stand = demoStand(isSampleId(sample) ? sample : "lemonade");
  await store.saveStand(stand);
  if (params.get("sales") === "clear") await store.clearSales(stand.id);
  return Response.json(stand);
}
