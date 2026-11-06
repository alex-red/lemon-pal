import { firstSale } from "@/lib/first-sale";
import { publicSale, type PublicSale } from "@/lib/sales";
import { store } from "@/lib/store";

// Polled by the seller tablet and the buyer's phone.
export async function GET(_request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const sale = await store.getSale(saleId);
  if (!sale) return Response.json({ error: "not found" }, { status: 404 });
  const body: PublicSale = publicSale(sale);
  if (sale.status === "paid") {
    const stand = await store.getStand(sale.standId);
    const first = stand && firstSale(stand, await store.listSales(sale.standId));
    if (first?.saleId === sale.id) body.firstSaleSeconds = first.seconds;
  }
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
