import "server-only";
import { donationLine, firstName, raisedCents } from "./donations";
import { kindOf } from "./stands";
import { store } from "./store";
import type { Cents } from "./money";
import type { DonationSettings, Sale, Stand, Storefront } from "./types";

/** A donation stand's public page by handle, or null. Only a donation stand with settings has one. */
export async function donationPage(slug: string): Promise<{ stand: Stand; storefront: Storefront & { donation: DonationSettings } } | null> {
  const storefront = await store.getStorefrontBySlug(slug);
  const stand = storefront ? await store.getStand(storefront.standId) : null;
  if (!storefront?.donation || !stand || kindOf(stand) !== "donation") return null;
  return { stand, storefront: storefront as Storefront & { donation: DonationSettings } };
}

/** An open sale for one gift. The caller has already checked the amount and cleaned the note. */
export function newDonationSale(stand: Stand, settings: DonationSettings, amountCents: Cents, note?: string): Sale {
  return {
    id: crypto.randomUUID(),
    standId: stand.id,
    currency: stand.currency,
    lines: [donationLine(settings, amountCents)],
    totalCents: amountCents,
    status: "open",
    paypalOrderId: null,
    paypalCaptureId: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
    channel: "donation",
    ...(note ? { note } : {}),
  };
}

/** One paid gift as the seller's display screen and editor see it. First name only, and the note. */
export type DonationFeedItem = {
  id: string;
  amountCents: Cents;
  paidAt: string;
  from: string | null;
  note: string | null;
  noteHidden: boolean;
};

export type DonationFeed = {
  raisedCents: Cents;
  count: number;
  goalCents: Cents | null;
  /** Newest first, at most 30. */
  recent: DonationFeedItem[];
};

/** The seller-only summary of a donation stand: what's been raised and the latest gifts with their notes. */
export function donationFeed(sales: Sale[], settings: DonationSettings | undefined): DonationFeed {
  const paid = sales
    .filter((s): s is Sale & { paidAt: string } => s.channel === "donation" && s.status === "paid" && s.paidAt !== null)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const raised = raisedCents(sales);
  return {
    raisedCents: raised.cents,
    count: raised.count,
    goalCents: settings?.goalCents ?? null,
    recent: paid.slice(0, 30).map((s) => ({
      id: s.id,
      amountCents: s.totalCents,
      paidAt: s.paidAt,
      from: firstName(s.buyerName),
      note: s.note ?? null,
      noteHidden: s.noteHidden === true,
    })),
  };
}
