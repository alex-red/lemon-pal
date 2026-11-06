import { DEMO_STAND_ID, getOrCreateDemoStand } from "@/lib/demo";
import { firstSale } from "@/lib/first-sale";
import { toRecap, type RecapData } from "@/lib/recap";
import { store } from "@/lib/store";

// Paid sales and their line-item snapshots for the AG Studio recap. Polled while the recap is open.
export async function GET() {
  const [stand, sales] = await Promise.all([getOrCreateDemoStand(), store.listSales(DEMO_STAND_ID)]);
  const body: RecapData = { ...toRecap(sales), firstSaleSeconds: firstSale(stand, sales)?.seconds ?? null };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
