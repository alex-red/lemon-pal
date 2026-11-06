import { firstSale } from "@/lib/first-sale";
import { toRecap, type RecapData } from "@/lib/recap";
import { requestStand, standNotFound } from "@/lib/session";
import { store } from "@/lib/store";

// Paid sales and their line-item snapshots for the AG Studio recap of one stand (?stand=). Polled while the recap is open.
export async function GET(request: Request) {
  const stand = await requestStand(request);
  if (!stand) return standNotFound();
  const sales = await store.listSales(stand.id);
  const body: RecapData = { ...toRecap(sales), firstSaleSeconds: firstSale(stand, sales)?.seconds ?? null };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
