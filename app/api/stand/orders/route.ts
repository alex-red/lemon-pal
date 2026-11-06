import { DEMO_STAND_ID } from "@/lib/demo";
import { listSellerOrders, waitingCount } from "@/lib/orders";

// The seller's paid online orders, with addresses. Behind the seller passcode (proxy.ts).
// The register polls it for the count and the newest order, so a seller at the stand hears about online orders.
// ?summary=1 leaves the orders out, for that poll.
export async function GET(request: Request) {
  const orders = await listSellerOrders(DEMO_STAND_ID);
  const summary = new URL(request.url).searchParams.has("summary");
  return Response.json(
    { ...(summary ? {} : { orders }), waiting: waitingCount(orders), latestPaidAt: orders[0]?.paidAt ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
