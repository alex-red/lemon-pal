import { z } from "zod";
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
      }),
    )
    .min(1)
    .max(24),
});

// Publishes the seller's confirmed catalog. Existing sales keep their own line-item snapshots.
export async function POST(request: Request) {
  const parsed = PublishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Every item needs a name and a price." }, { status: 400 });
  }
  const current = await getOrCreateDemoStand();
  const stand = {
    ...current,
    name: parsed.data.name || current.name,
    publishedAt: new Date().toISOString(),
    items: parsed.data.items.map((item, i) => ({ id: `item-${i + 1}-${Date.now().toString(36)}`, ...item })),
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
