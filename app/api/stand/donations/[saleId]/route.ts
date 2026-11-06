import { z } from "zod";
import { ownedSale } from "@/lib/session";
import { store } from "@/lib/store";

const Body = z.object({ noteHidden: z.boolean() });

// Hides a donor's note from the display screen, or shows it again. The gift itself doesn't change.
export async function PATCH(request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Say whether to hide the note." }, { status: 400 });
  const { saleId } = await params;
  const owned = await ownedSale(saleId);
  if (!owned || owned.sale.channel !== "donation") return Response.json({ error: "not found" }, { status: 404 });
  const sale = await store.updateSale(saleId, (s) => ({ ...s, noteHidden: parsed.data.noteHidden }));
  return Response.json({ id: saleId, noteHidden: sale?.noteHidden === true });
}
