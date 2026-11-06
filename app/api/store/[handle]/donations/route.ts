import { z } from "zod";
import { donationPage, newDonationSale } from "@/lib/donation-sales";
import { cleanNote, giftProblem, MAX_GIFT_CENTS } from "@/lib/donations";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { store } from "@/lib/store";

// Anyone on the internet can start a gift here, so keep each address to a handful a minute.
const allow = createRateLimiter({ limit: 12, windowMs: 60_000 });

const GiftSchema = z.object({
  amountCents: z.number().int().min(1).max(MAX_GIFT_CENTS),
  note: z.string().max(400).optional(),
});

// Opens a gift on a donation stand and hands back its sale id. The donor pays on the usual /pay page.
// The amount is the donor's choice, so it's the one figure taken from the client, and only inside the seller's limits.
export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  if (!allow(clientKey(request))) {
    return Response.json({ error: "Too many at once. Wait a minute and try again." }, { status: 429 });
  }
  const parsed = GiftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose an amount." }, { status: 400 });

  const found = await donationPage((await params).handle);
  if (!found) return Response.json({ error: "not found" }, { status: 404 });
  const { stand, storefront } = found;
  if (!storefront.open) return Response.json({ error: "This page isn’t taking gifts right now." }, { status: 409 });

  const problem = giftProblem(storefront.donation, parsed.data.amountCents, stand.currency);
  if (problem) return Response.json({ error: problem, field: "amount" }, { status: 400 });
  // A note is only kept when the seller asks for notes, and only once it's been cleaned.
  const cleaned = storefront.donation.notes ? cleanNote(parsed.data.note) : {};
  if (cleaned.error) return Response.json({ error: cleaned.error, field: "note" }, { status: 400 });

  const sale = newDonationSale(stand, storefront.donation, parsed.data.amountCents, cleaned.note);
  await store.saveSale(sale);
  return Response.json({ saleId: sale.id }, { status: 201 });
}
