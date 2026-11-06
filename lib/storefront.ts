import "server-only";
import { lineTotalCents } from "./deals";
import { toHandle } from "./handles";
import { CartError, priceCart, type CartEntry } from "./sales";
import { shippingCents, type FulfillmentMethod } from "./shipping";
import type { CatalogItem, Fulfillment, SaleLine, Stand, Storefront } from "./types";

/** The country a new store ships to, from the stand's currency. */
function homeCountry(currency: string): string {
  return { USD: "US", CAD: "CA", GBP: "GB", AUD: "AU", NZD: "NZ", EUR: "DE", JPY: "JP", MXN: "MX" }[currency] ?? "US";
}

/** A first draft for the editor. Closed, so nothing goes live until the seller opens it. */
export function draftStorefront(stand: Stand): Storefront {
  return {
    standId: stand.id,
    slug: toHandle(stand.name) || "my-stand",
    title: stand.name,
    intro: "",
    accent: "lemon",
    open: false,
    pickup: true,
    pickupNote: "",
    shipping: { enabled: false, flatRateCents: 500, freeOverCents: null, countries: [homeCountry(stand.currency)] },
    updatedAt: new Date().toISOString(),
  };
}

export const sellsOnline = (item: CatalogItem) => item.online !== false;
export const shipsOnline = (item: CatalogItem) => item.ships === true;

/** The items a buyer can order: offered online, and either collectable or shippable. */
export function onlineItems(stand: Stand, storefront: Storefront): CatalogItem[] {
  return stand.items.filter(
    (item) => sellsOnline(item) && (storefront.pickup || (storefront.shipping.enabled && shipsOnline(item))),
  );
}

/** Which ways an order can reach the buyer at all. */
export function methodsOffered(storefront: Storefront): FulfillmentMethod[] {
  return [...(storefront.pickup ? (["pickup"] as const) : []), ...(storefront.shipping.enabled ? (["ship"] as const) : [])];
}

export type OnlineOrder = {
  lines: SaleLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  fulfillment: Fulfillment;
};

/** Prices an online cart from the stored catalog and shipping settings. Nothing the browser sends is trusted but ids and counts. */
export function priceOnlineOrder(stand: Stand, storefront: Storefront, cart: CartEntry[], method: FulfillmentMethod): OnlineOrder {
  if (!storefront.open) throw new CartError("This store isn’t taking orders right now.");
  if (!methodsOffered(storefront).includes(method)) {
    throw new CartError(method === "ship" ? "This store doesn’t ship." : "This store doesn’t offer pickup.");
  }
  for (const { itemId } of cart) {
    const item = stand.items.find((i) => i.id === itemId);
    if (!item || !sellsOnline(item)) throw new CartError("Something in your cart isn’t sold online any more.");
    if (method === "ship" && !shipsOnline(item)) throw new CartError(`${item.name} is pickup only.`);
  }
  const { lines } = priceCart(stand, cart);
  const subtotalCents = lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
  const shipping = method === "ship" ? shippingCents(storefront.shipping, subtotalCents) : 0;
  return {
    lines,
    subtotalCents,
    shippingCents: shipping,
    totalCents: subtotalCents + shipping,
    fulfillment: method === "ship" ? { method: "ship", status: "to_ship" } : { method: "pickup", status: "to_collect" },
  };
}

/** The banner's public URL, versioned so a new banner isn't hidden by a cached old one. */
export function bannerUrl(storefront: Storefront): string | null {
  return storefront.banner ? `/api/store/${storefront.slug}/banner?v=${encodeURIComponent(storefront.updatedAt)}` : null;
}

/** A storefront without its banner data, for pages and API responses. */
export function withoutBanner(storefront: Storefront) {
  const rest: Omit<Storefront, "banner"> & { banner?: string } = { ...storefront };
  delete rest.banner;
  return { ...rest, bannerUrl: bannerUrl(storefront) };
}
export type PublicStorefront = ReturnType<typeof withoutBanner>;
