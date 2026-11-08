import { z } from "zod";
import { ItemInputSchema, MAX_ITEMS, withCatalog } from "@/lib/catalog";
import { isSampleId, resetStand, sampleStand } from "@/lib/demo";
import { requestStand, standNotFound } from "@/lib/session";
import { kindOf } from "@/lib/stands";
import { store } from "@/lib/store";

const PublishSchema = z.object({
  // Optional: a stand published without a name keeps its current one.
  name: z.string().trim().max(40).optional(),
  // An inventory update to a published stand: it keeps its publish time, so the first-sale clock isn't restarted.
  update: z.boolean().optional(),
  items: z.array(ItemInputSchema).min(1).max(MAX_ITEMS),
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
  const current = await requestStand(request);
  if (!current) return standNotFound();
  if (kindOf(current) === "donation") return Response.json({ error: "A donation stand has no items." }, { status: 409 });
  const stand = withCatalog(current, parsed.data);
  await store.saveStand(stand);
  return Response.json(stand);
}

// Loads a sample catalog into the stand: ?sample=bake-sale.
// Without a sample and with ?sales=clear, it's the judge demo reset: the stand's own sample comes back and its sales go.
export async function DELETE(request: Request) {
  const current = await requestStand(request);
  if (!current) return standNotFound();
  const params = new URL(request.url).searchParams;
  const sample = params.get("sample");
  if (!isSampleId(sample)) {
    if (params.get("sales") !== "clear") return Response.json({ error: "Choose a sample." }, { status: 400 });
    return Response.json(await resetStand(current));
  }
  if (kindOf(current) === "donation") return Response.json({ error: "A donation stand has no items." }, { status: 409 });
  const stand = sampleStand(sample, current);
  await store.saveStand(stand);
  if (params.get("sales") === "clear") await store.clearSales(stand.id);
  return Response.json(stand);
}

