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
  /** Whether the online store sells it. Missing means yes. */
  online?: boolean;
  /** Whether it can be posted to an online buyer. Missing means pickup only. */
  ships?: boolean;
  /** A shelf the recap groups items by, such as "Animals". Optional. */
  category?: string;
  /** What it's made of or how it's finished, such as "Holographic". Optional. */
  finish?: string;
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

/** Local stands sell in person through the register. Online stands sell through a storefront. */
export type StandKind = "local" | "online";

/** A seller: someone who logged in with PayPal, or a demo account made past the seller passcode. */
export type User = {
  id: string;
  name: string;
  createdAt: string;
  /** The seller's stable PayPal id, for a seller who signed in with PayPal. Demo accounts have none. */
  paypalId?: string;
  email?: string;
  /** A throwaway demo account, deleted once it goes unused for 30 days. */
  demo?: true;
  /** When a demo account was last used, at most an hour out of date. */
  lastSeenAt?: string;
};

export type Stand = {
  id: string;
  /** The user who owns it. Missing only on stands from before accounts, which nobody can open now. */
  ownerId?: string;
  /** Missing on stands from before accounts, which are local. */
  kind?: StandKind;
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
  /** The item's category and finish when it was sold, for the recap. */
  category?: string;
  finish?: string;
};

/** A sale moves open → paid, or open → canceled. Only a paid sale can become refunded. */
export type SaleStatus = "open" | "paid" | "canceled" | "refunded";

/** Where a sale was made: rung up at the stand, or bought from the online store. */
export type SaleChannel = "register" | "online";

/** A postal address as PayPal returns it, in our own field names. */
export type PostalAddress = {
  line1: string;
  line2?: string;
  /** City or town (PayPal's admin_area_2). */
  city: string;
  /** State, province or region (PayPal's admin_area_1). */
  region?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2, such as "US". */
  country: string;
};

export type ShippingCarrier = "USPS" | "UPS" | "FEDEX" | "DHL" | "OTHER";

/** How an online order reaches the buyer. The address arrives from PayPal when the order is paid. */
export type Fulfillment =
  | { method: "pickup"; status: "to_collect" | "collected"; collectedAt?: string }
  | {
      method: "ship";
      status: "to_ship" | "shipped";
      recipient?: string;
      address?: PostalAddress;
      carrier?: ShippingCarrier;
      carrierName?: string;
      tracking?: string;
      shippedAt?: string;
      /** Whether PayPal accepted the tracking number, so the buyer sees it in PayPal. */
      trackingSentToPayPal?: boolean;
    };

export type Sale = {
  id: string;
  standId: string;
  currency: string;
  lines: SaleLine[];
  /** What the buyer pays: the lines after deals, plus shipping. */
  totalCents: Cents;
  status: SaleStatus;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  createdAt: string;
  paidAt: string | null;
  /** Missing on sales from before the online store, which were all rung up at the stand. */
  channel?: SaleChannel;
  /** Shipping charged on top of the lines. Missing or 0 for pickup and register sales. */
  shippingCents?: Cents;
  /** Online orders only. */
  fulfillment?: Fulfillment;
  /** The payer's name from PayPal, for online orders, so the seller knows whose order it is. */
  buyerName?: string;
  /** Set when the seller refunded the whole capture and PayPal accepted it. */
  refund?: { paypalRefundId: string; refundedAt: string };
  /**
   * Set when PayPal took the payment but is still moving the money (an eCheck, say). The sale stays open, so it
   * isn't counted as paid, and the buyer is told not to pay again. The capture route clears it once PayPal completes.
   */
  pendingCapture?: { captureId: string; reason: string; since: string };
  /** A sale the sticker shop demo made up. It never went through PayPal, so refunds and tracking stay local. */
  demo?: boolean;
};

export type StorefrontAccent = "lemon" | "leaf" | "berry";

export type ShippingSettings = {
  /** Whether buyers can choose to have items posted. */
  enabled: boolean;
  /** Charged once per order. */
  flatRateCents: Cents;
  /** Orders with items worth at least this ship free. null for no threshold. */
  freeOverCents: Cents | null;
  /** ISO 3166-1 alpha-2 codes the seller ships to. */
  countries: string[];
};

/** The public online store for a stand, at /<slug>. */
export type Storefront = {
  standId: string;
  /** The vanity handle: lowercase letters, digits and single hyphens. */
  slug: string;
  title: string;
  intro: string;
  /** A 3:1 JPEG data URL, served from /api/store/<slug>/banner. */
  banner?: string;
  accent: StorefrontAccent;
  /** Whether buyers can place orders. A closed store still shows its page. */
  open: boolean;
  pickup: boolean;
  /** Where and when to collect, such as "Saturdays at the farmers' market". */
  pickupNote: string;
  shipping: ShippingSettings;
  updatedAt: string;
};
