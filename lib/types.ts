import type { Deal } from "./deals";
import type { Cents } from "./money";

export type CatalogItem = {
  id: string;
  name: string;
  priceCents: Cents;
  /** One emoji shown large on the register tile. Optional: tiles fall back to the item's initial. */
  emoji?: string;
  /** A small JPEG data URL cropped from the seller's photo. Shown on the register tile in place of the emoji. */
  image?: string;
  /** A confirmed multi-buy price, such as 2 for $5. The server applies it when pricing a sale. */
  deal?: Deal;
};

/** Part of a photo, as fractions of its width and height from the top-left corner. */
export type Region = { x: number; y: number; width: number; height: number };

/** An item the vision model read from a sign, before the seller confirms it. */
export type DraftItem = {
  name: string;
  /** null when the price on the sign was unreadable; the seller must enter it. */
  priceCents: Cents | null;
  confidence: "high" | "low";
  /** An emoji the model picked for the item, for the seller to keep or change. */
  emoji?: string;
  /** Where the item's products are in the photo, when it shows them, for cropping a thumbnail. */
  region?: Region;
  /** A multi-buy price the model read for this item, for the seller to confirm or remove. */
  deal?: Deal;
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
  /** When the seller first read a sign or list for the catalog being drafted. Cleared on publish. */
  draftStartedAt?: string | null;
  /** When setup began for the published catalog, from its draft. null for a blank form or a sample stand. */
  setupStartedAt?: string | null;
};

/** Snapshot of an item at the time of sale, so later catalog edits never change a past sale. */
export type SaleLine = {
  itemId: string;
  name: string;
  emoji?: string;
  unitPriceCents: Cents;
  quantity: number;
  /** The deal in force when the sale was rung up, if any. */
  deal?: Deal;
  /** What the deal took off this line. The line costs unitPriceCents × quantity − discountCents. */
  discountCents?: Cents;
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
