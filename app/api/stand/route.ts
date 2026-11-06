import { z } from "zod";
import { demoStand, getOrCreateDemoStand } from "@/lib/demo";
import { store } from "@/lib/store";

const PublishSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        // The seller confirms every price; nothing unreadable gets through.
        priceCents: z.number().int().min(1).max(100_000),
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
    publishedAt: new Date().toISOString(),
    items: parsed.data.items.map((item, i) => ({ id: `item-${i + 1}-${Date.now().toString(36)}`, ...item })),
  };
  await store.saveStand(stand);
  return Response.json(stand);
}

// Restores the sample catalog, for the judge demo.
export async function DELETE() {
  const stand = demoStand();
  await store.saveStand(stand);
  return Response.json(stand);
}
