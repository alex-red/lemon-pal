import { DEMO_STAND_ID } from "@/lib/demo";
import { toRecap } from "@/lib/recap";
import { store } from "@/lib/store";

// Paid sales and their line-item snapshots for the AG Studio recap. Polled while the recap is open.
export async function GET() {
  const sales = await store.listSales(DEMO_STAND_ID);
  return Response.json(toRecap(sales), { headers: { "Cache-Control": "no-store" } });
}
