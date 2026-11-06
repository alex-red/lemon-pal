import { z } from "zod";
import { donationFeed, newDonationSale } from "@/lib/donation-sales";
import { defaultDonation, MAX_GIFT_CENTS, MIN_GIFT_CENTS } from "@/lib/donations";
import { formatMoney } from "@/lib/money";
import { publicSale } from "@/lib/sales";
import { requestStand, standNotFound } from "@/lib/session";
import { kindOf } from "@/lib/stands";
import { store } from "@/lib/store";

const notDonation = () => Response.json({ error: "Only a donation stand takes gifts." }, { status: 409 });

// What a donation stand (?stand=) has raised, and its latest gifts with first names and notes. Seller-only, so it
// sits under /api/stand/. Polled by the display screen and the editor.
export async function GET(request: Request) {
  const stand = await requestStand(request);
  if (!stand) return standNotFound();
  if (kindOf(stand) !== "donation") return notDonation();
  const [sales, storefront] = await Promise.all([store.listSales(stand.id), store.getStorefront(stand.id)]);
  return Response.json(donationFeed(sales, storefront?.donation), { headers: { "Cache-Control": "no-store" } });
}

const AmountSchema = z.object({ amountCents: z.number().int().min(MIN_GIFT_CENTS).max(MAX_GIFT_CENTS) });

// The seller types an amount for someone in front of them, and the display shows a code for just that gift.
// The seller is signed in and chose the amount, so it only has to be within the platform's limits.
export async function POST(request: Request) {
  const stand = await requestStand(request);
  if (!stand) return standNotFound();
  if (kindOf(stand) !== "donation") return notDonation();
  const parsed = AmountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: `Enter an amount from ${formatMoney(MIN_GIFT_CENTS, stand.currency)} to ${formatMoney(MAX_GIFT_CENTS, stand.currency)}.` },
      { status: 400 },
    );
  }
  const settings = (await store.getStorefront(stand.id))?.donation ?? defaultDonation();
  const sale = newDonationSale(stand, settings, parsed.data.amountCents);
  await store.saveSale(sale);
  return Response.json(publicSale(sale), { status: 201 });
}
