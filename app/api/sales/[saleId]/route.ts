import { publicSale } from "@/lib/sales";
import { store } from "@/lib/store";

// Polled by the seller tablet and the buyer's phone.
export async function GET(_request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const sale = await store.getSale(saleId);
  if (!sale) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(publicSale(sale), { headers: { "Cache-Control": "no-store" } });
}
