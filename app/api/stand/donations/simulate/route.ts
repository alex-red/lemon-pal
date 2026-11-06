import { simulatedGift } from "@/lib/demo-fundraiser";
import { defaultDonation } from "@/lib/donations";
import { currentUser, requestStand, standNotFound } from "@/lib/session";
import { kindOf } from "@/lib/stands";
import { store } from "@/lib/store";

// Adds one made-up paid gift to a demo account's donation stand, so a demo can show the poster's chime, the pop-up
// and the goal bar moving without a phone and PayPal. Demo accounts only: the gift is marked demo and never reaches PayPal.
export async function POST(request: Request) {
  const [user, stand] = await Promise.all([currentUser(), requestStand(request)]);
  if (!user.demo) return Response.json({ error: "Simulated gifts are for demo accounts only." }, { status: 403 });
  if (!stand) return standNotFound();
  if (kindOf(stand) !== "donation") return Response.json({ error: "Only a donation stand takes gifts." }, { status: 409 });
  const settings = (await store.getStorefront(stand.id))?.donation ?? defaultDonation();
  const sale = simulatedGift(stand, settings);
  await store.saveSale(sale);
  return Response.json({ id: sale.id, amountCents: sale.totalCents }, { status: 201 });
}
