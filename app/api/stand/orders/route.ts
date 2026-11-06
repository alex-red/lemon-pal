import { listSellerOrders, waitingCount, type SellerOrder } from "@/lib/orders";
import { currentUser, requestStand, standNotFound, userStands } from "@/lib/session";
import { kindOf } from "@/lib/stands";

// The seller's paid online orders, with addresses. Behind the seller passcode (proxy.ts).
// The register polls it for the count and the newest order, so a seller at the stand hears about online orders.
// ?summary=1 leaves the orders out, for that poll, and counts every online stand the seller has: the register runs
// a local stand, and the orders come in on the seller's online ones.
export async function GET(request: Request) {
  const summary = new URL(request.url).searchParams.has("summary");
  let orders: SellerOrder[];
  if (summary) {
    const stands = (await userStands(await currentUser())).filter((stand) => kindOf(stand) === "online");
    orders = (await Promise.all(stands.map((stand) => listSellerOrders(stand.id))))
      .flat()
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  } else {
    const stand = await requestStand(request);
    if (!stand) return standNotFound();
    orders = await listSellerOrders(stand.id);
  }
  return Response.json(
    { ...(summary ? {} : { orders }), waiting: waitingCount(orders), latestPaidAt: orders[0]?.paidAt ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
