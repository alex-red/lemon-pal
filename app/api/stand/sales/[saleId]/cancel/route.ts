import { publicSale } from "@/lib/sales";
import { ownedSale } from "@/lib/session";
import { store } from "@/lib/store";

// Called when the seller cancels a sale before it's paid, so its QR code can't be paid later.
// A sale that's already paid stays paid.
export async function POST(_request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  if (!(await ownedSale(saleId))) return Response.json({ error: "not found" }, { status: 404 });
  const sale = await store.updateSale(saleId, (s) => (s.status === "open" ? { ...s, status: "canceled" } : null));
  if (!sale) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(publicSale(sale));
}
