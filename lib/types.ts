import type { Cents } from "./money";

export type CatalogItem = {
  id: string;
  name: string;
  priceCents: Cents;
  /** One emoji shown large on the register tile. Optional: tiles fall back to the item's initial. */
  emoji?: string;
};

/** An item the vision model read from a sign, before the seller confirms it. */
export type DraftItem = {
  name: string;
  /** null when the price on the sign was unreadable; the seller must enter it. */
  priceCents: Cents | null;
  confidence: "high" | "low";
  /** An emoji the model picked for the item, for the seller to keep or change. */
  emoji?: string;
};

/** What the vision model read from a sign photo. */
export type SignDraft = {
  /** The stand's name if the sign shows one. */
  standName: string | null;
  items: DraftItem[];
};

export type Stand = {
  id: string;
  name: string;
  currency: string;
  items: CatalogItem[];
  publishedAt: string | null;
};

/** Snapshot of an item at the time of sale, so later catalog edits never change a past sale. */
export type SaleLine = {
  itemId: string;
  name: string;
  emoji?: string;
  unitPriceCents: Cents;
  quantity: number;
};

export type SaleStatus = "open" | "paid" | "canceled";

export type Sale = {
  id: string;
  standId: string;
  currency: string;
  lines: SaleLine[];
  totalCents: Cents;
  status: SaleStatus;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  createdAt: string;
  paidAt: string | null;
};
