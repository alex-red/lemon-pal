import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { priceCart, type CartEntry } from "./sales";
import { priceOnlineOrder } from "./storefront";
import type { CatalogItem, PostalAddress, Sale, ShippingCarrier, Stand, Storefront } from "./types";

/*
 * The sticker shop demo: fills a demo account's two stands with the same sticker shop. The local stand gets
 * the market sales, and the online stand gets an open store and its orders. A month of sales in all,
 * so the store page, the orders page and the AG Studio recap all have something to show.
 * Everything here is made up. The names, streets and postcodes belong to nobody, and no sale went through PayPal:
 * each one carries `demo: true`, so refunds and tracking for it stay local.
 */

/** Each demo account's store gets this handle plus a short tag of its own, like peel-and-stick-3f2a. */
export const STICKER_SLUG = "peel-and-stick";
const DAYS = 30;

type DemoItem = CatalogItem & { /** How often buyers pick it, relative to the others. */ weight: number };

const ITEMS: DemoItem[] = [
  { id: "sleepy-cat", name: "Sleepy Cat", emoji: "🐱", priceCents: 400, category: "Animals", finish: "Holographic", deal: { quantity: 3, priceCents: 1000 }, weight: 14 },
  { id: "frog-hat", name: "Frog in a Hat", emoji: "🐸", priceCents: 350, category: "Animals", finish: "Matte", deal: { quantity: 2, priceCents: 600 }, weight: 12 },
  { id: "otter-pals", name: "Otter Pals", emoji: "🦦", priceCents: 400, category: "Animals", finish: "Glossy", weight: 8 },
  { id: "busy-bee", name: "Busy Bee", emoji: "🐝", priceCents: 300, category: "Animals", finish: "Glossy", weight: 6 },
  { id: "boba-buddy", name: "Boba Buddy", emoji: "🧋", priceCents: 350, category: "Food", finish: "Holographic", deal: { quantity: 3, priceCents: 900 }, weight: 13 },
  { id: "happy-toast", name: "Happy Toast", emoji: "🍞", priceCents: 300, category: "Food", finish: "Matte", weight: 5 },
  { id: "strawberry-milk", name: "Strawberry Milk", emoji: "🍓", priceCents: 300, category: "Food", finish: "Glossy", weight: 7 },
  { id: "moon-phases", name: "Moon Phases", emoji: "🌙", priceCents: 450, category: "Space", finish: "Holographic", weight: 9 },
  { id: "tiny-ufo", name: "Tiny UFO", emoji: "🛸", priceCents: 350, category: "Space", finish: "Glossy", weight: 6 },
  { id: "mushroom-friend", name: "Mushroom Friend", emoji: "🍄", priceCents: 350, category: "Plants", finish: "Matte", deal: { quantity: 3, priceCents: 900 }, weight: 10 },
  { id: "cactus-hug", name: "Cactus Hug", emoji: "🌵", priceCents: 300, category: "Plants", finish: "Glossy", weight: 5 },
  { id: "rainbow-sheet", name: "Rainbow Sheet", emoji: "🌈", priceCents: 800, category: "Packs", finish: "Glossy", weight: 6 },
  // Hand-packed at the market, so it's pickup only.
  { id: "mystery-pack", name: "Mystery Pack", emoji: "🎁", priceCents: 1200, category: "Packs", finish: "Mixed", deal: { quantity: 2, priceCents: 2000 }, weight: 5, ships: false },
];

function catalog(): CatalogItem[] {
  return ITEMS.map((item) => {
    const { weight, ...rest } = item;
    void weight;
    return { ...rest, image: `/demo/stickers/${item.id}.webp`, ships: item.ships ?? true };
  });
}

// Real places, so the region charts mean something. Streets and postcodes are invented.
type Place = { city: string; region: string; country: string; postal: () => string; weight: number };
const digits = (rand: Rand, n: number) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join("");
const letters = (rand: Rand, n: number) => Array.from({ length: n }, () => "ABDEFGHJLNPRSTUWXYZ"[Math.floor(rand() * 19)]).join("");
const usZip = (prefix: string) => (rand: Rand) => prefix + digits(rand, 2);
const PLACES = (rand: Rand): Place[] => [
  { city: "Portland", region: "OR", country: "US", postal: () => usZip("972")(rand), weight: 14 },
  { city: "Seattle", region: "WA", country: "US", postal: () => usZip("981")(rand), weight: 9 },
  { city: "Oakland", region: "CA", country: "US", postal: () => usZip("946")(rand), weight: 8 },
  { city: "Los Angeles", region: "CA", country: "US", postal: () => usZip("900")(rand), weight: 7 },
  { city: "Austin", region: "TX", country: "US", postal: () => usZip("787")(rand), weight: 7 },
  { city: "Brooklyn", region: "NY", country: "US", postal: () => usZip("112")(rand), weight: 9 },
  { city: "Chicago", region: "IL", country: "US", postal: () => usZip("606")(rand), weight: 6 },
  { city: "Denver", region: "CO", country: "US", postal: () => usZip("802")(rand), weight: 5 },
  { city: "Minneapolis", region: "MN", country: "US", postal: () => usZip("554")(rand), weight: 4 },
  { city: "Asheville", region: "NC", country: "US", postal: () => usZip("288")(rand), weight: 3 },
  { city: "Boston", region: "MA", country: "US", postal: () => "021" + digits(rand, 2), weight: 4 },
  { city: "Toronto", region: "ON", country: "CA", postal: () => `M${digits(rand, 1)}${letters(rand, 1)} ${digits(rand, 1)}${letters(rand, 1)}${digits(rand, 1)}`, weight: 5 },
  { city: "Vancouver", region: "BC", country: "CA", postal: () => `V${digits(rand, 1)}${letters(rand, 1)} ${digits(rand, 1)}${letters(rand, 1)}${digits(rand, 1)}`, weight: 4 },
  { city: "Montréal", region: "QC", country: "CA", postal: () => `H${digits(rand, 1)}${letters(rand, 1)} ${digits(rand, 1)}${letters(rand, 1)}${digits(rand, 1)}`, weight: 2 },
  { city: "London", region: "England", country: "GB", postal: () => `E${digits(rand, 1)} ${digits(rand, 1)}${letters(rand, 2)}`, weight: 4 },
  { city: "Bristol", region: "England", country: "GB", postal: () => `BS${digits(rand, 1)} ${digits(rand, 1)}${letters(rand, 2)}`, weight: 2 },
  { city: "Edinburgh", region: "Scotland", country: "GB", postal: () => `EH${digits(rand, 1)} ${digits(rand, 1)}${letters(rand, 2)}`, weight: 2 },
];

const FIRST = ["Maya", "Jonah", "Priya", "Theo", "Ines", "Kai", "Noor", "Sam", "Lucia", "Omar", "Hazel", "Felix", "Aiko", "Rafa", "June", "Milo", "Zara", "Eli", "Tess", "Dev", "Ada", "Nico", "Rosa", "Finn"];
const LAST = ["Alder", "Brightwater", "Calloway", "Dunmore", "Ellery", "Fairbank", "Glenhart", "Hollis", "Ivers", "Juniper", "Kestrel", "Larkin", "Merriweather", "Northcote", "Oakhurst", "Pemberly", "Quill", "Rowan", "Sorrel", "Thistlewood"];
const STREETS = ["Maple Hollow Ln", "Brightleaf Ave", "Quarry Rd", "Little Fern St", "Otter Creek Way", "Pinecone Ct", "Lantern Row", "Marigold Dr", "Kettle St", "Willowmere Rd"];

type Rand = () => number;

/** A small seeded generator, so the demo comes out the same every time. */
function mulberry32(seed: number): Rand {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T extends { weight: number }>(rand: Rand, options: T[]): T {
  let roll = rand() * options.reduce((sum, o) => sum + o.weight, 0);
  for (const option of options) {
    roll -= option.weight;
    if (roll < 0) return option;
  }
  return options[options.length - 1];
}

const oneOf = <T,>(rand: Rand, list: readonly T[]) => list[Math.floor(rand() * list.length)];
const between = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

/** One to three different stickers. Buyers often take just enough for a deal. */
function cart(rand: Rand, items: DemoItem[]): CartEntry[] {
  const kinds = rand() < 0.45 ? 1 : rand() < 0.7 ? 2 : 3;
  const chosen = new Map<string, number>();
  for (let i = 0; i < kinds * 3 && chosen.size < kinds; i++) {
    const item = pick(rand, items);
    if (chosen.has(item.id)) continue;
    const quantity = item.deal && rand() < 0.5 ? item.deal.quantity : rand() < 0.7 ? 1 : between(rand, 2, 4);
    chosen.set(item.id, quantity);
  }
  return [...chosen].map(([itemId, quantity]) => ({ itemId, quantity }));
}

const CARRIERS: { carrier: ShippingCarrier; weight: number }[] = [
  { carrier: "USPS", weight: 8 },
  { carrier: "UPS", weight: 2 },
  { carrier: "FEDEX", weight: 1 },
];

function tracking(rand: Rand, carrier: ShippingCarrier): string {
  if (carrier === "UPS") return `1Z${letters(rand, 3)}${digits(rand, 13)}`;
  if (carrier === "FEDEX") return digits(rand, 12);
  return `9400${digits(rand, 18)}`;
}

/**
 * A Date `minutes` after midnight on the day `daysAgo` before now, in the seller's own time zone.
 * The browser sends its offset, because the server (UTC on Render) can't know it.
 */
function localTime(now: Date, daysAgo: number, minutes: number, tzOffsetMinutes: number): Date {
  // Shift into the seller's wall clock, set the time there, then shift back.
  const wall = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  wall.setUTCDate(wall.getUTCDate() - daysAgo);
  wall.setUTCHours(0, minutes, 0, 0);
  return new Date(wall.getTime() + tzOffsetMinutes * 60_000);
}

export type StickerDemo = { local: Stand; online: Stand; storefront: Storefront; sales: Sale[] };

/** Where the demo goes: whose it is, the two stands' ids, and the store's handle. */
export type StickerTarget = { ownerId: string; localId: string; onlineId: string; slug: string };

/** Builds the whole demo. Pure apart from reading the banner, so it can be checked on its own. */
export async function buildStickerDemo(
  target: StickerTarget,
  options: { now?: Date; tzOffsetMinutes?: number } = {},
): Promise<StickerDemo> {
  const now = options.now ?? new Date();
  const tz = options.tzOffsetMinutes ?? 0;
  const rand = mulberry32(20261106);
  const places = PLACES(rand);
  const banner = await readFile(path.join(process.cwd(), "public/demo/sticker-banner.jpg"));

  const stand: Stand = {
    id: target.localId,
    ownerId: target.ownerId,
    kind: "local",
    name: "Peel & Stick Club",
    currency: env.currency(),
    publishedAt: localTime(now, DAYS, 8 * 60, tz).toISOString(),
    setupStartedAt: null,
    draftStartedAt: null,
    items: catalog(),
  };
  // The same shop online: one catalog, sold through the store. Item ids match, so the recaps line up.
  const online: Stand = { ...stand, id: target.onlineId, kind: "online" };
  const storefront: Storefront = {
    standId: online.id,
    slug: target.slug,
    title: "Peel & Stick Club",
    intro:
      "Tiny waterproof friends for your laptop, water bottle and sketchbook.\n" +
      "Every design is drawn by hand and printed on thick vinyl. Mix and match to unlock bundle deals.",
    banner: `data:image/jpeg;base64,${banner.toString("base64")}`,
    accent: "berry",
    open: true,
    pickup: true,
    pickupNote: "Saturdays 9 to 2 at the Riverside Market, by the fountain.",
    shipping: { enabled: true, flatRateCents: 400, freeOverCents: 2500, countries: ["US", "CA", "GB"] },
    updatedAt: now.toISOString(),
  };

  const shippable = ITEMS.filter((item) => item.ships !== false);
  const sales: Sale[] = [];
  let n = 0;
  // Follow-ups (shipped, collected, refunded) land after the sale but never after now.
  const past = (ms: number) => new Date(Math.min(ms, now.getTime() - 60_000)).toISOString();
  const nowMinutes = (() => {
    const wall = new Date(now.getTime() - tz * 60_000);
    return wall.getUTCHours() * 60 + wall.getUTCMinutes();
  })();

  function record(paidAt: Date, base: Omit<Sale, "id" | "standId" | "currency" | "status" | "paypalOrderId" | "paypalCaptureId" | "createdAt" | "paidAt" | "demo">, daysAgo: number) {
    n += 1;
    // About one in twenty-five older sales was refunded. Today's never are, so the live total stays clean.
    const refunded = daysAgo > 0 && rand() < 0.04;
    const paid = paidAt.toISOString();
    sales.push({
      id: crypto.randomUUID(),
      // Market sales belong to the stand at events, store orders to the online stand.
      standId: base.channel === "online" ? online.id : stand.id,
      currency: stand.currency,
      status: refunded ? "refunded" : "paid",
      paypalOrderId: `DEMO-ORDER-${n}`,
      paypalCaptureId: `DEMO-CAPTURE-${n}`,
      createdAt: new Date(paidAt.getTime() - between(rand, 25, 90) * 1000).toISOString(),
      paidAt: paid,
      ...base,
      ...(refunded
        ? { refund: { paypalRefundId: `DEMO-REFUND-${n}`, refundedAt: past(paidAt.getTime() + between(rand, 1, 30) * 3_600_000) } }
        : {}),
      demo: true,
    });
  }

  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
    const day = localTime(now, daysAgo, 0, tz);
    const weekday = new Date(day.getTime() - tz * 60_000).getUTCDay();
    // Only the part of today that has already happened.
    const latest = daysAgo === 0 ? Math.max(nowMinutes - 5, 0) : 24 * 60 - 1;
    const at = (minutes: number) => (minutes <= latest ? localTime(now, daysAgo, minutes, tz) : null);

    // At the stand: a busy Saturday market, a smaller Sunday pop-up, and the odd weekday café table.
    const marketSales = weekday === 6 ? between(rand, 28, 42) : weekday === 0 ? between(rand, 10, 18) : rand() < 0.35 ? between(rand, 2, 6) : 0;
    // Today always has a few, spread over the last few hours, so the live total isn't empty.
    const [open, close] =
      daysAgo === 0 ? [Math.max(latest - 240, 0), latest] : weekday === 6 ? [9 * 60, 14 * 60] : weekday === 0 ? [11 * 60, 15 * 60] : [16 * 60, 19 * 60];
    for (let i = 0; i < (daysAgo === 0 ? Math.max(marketSales, 5) : marketSales); i++) {
      // Busiest mid-market: two rolls pull the times toward the middle.
      const minutes = open + Math.floor(((rand() + rand()) / 2) * (close - open));
      const paidAt = at(minutes);
      if (!paidAt) continue;
      const priced = priceCart(stand, cart(rand, ITEMS));
      record(paidAt, { lines: priced.lines, totalCents: priced.totalCents, channel: "register" }, daysAgo);
    }

    // Online: a steady trickle, busier in the evening and the day after a market.
    const onlineOrders = between(rand, 2, 5) + (weekday === 0 || weekday === 1 ? between(rand, 1, 3) : 0);
    for (let i = 0; i < onlineOrders; i++) {
      const minutes = rand() < 0.6 ? between(rand, 18 * 60, 23 * 60) : between(rand, 7 * 60, 18 * 60);
      const paidAt = at(minutes);
      if (!paidAt) continue;
      const method = rand() < 0.78 ? "ship" : "pickup";
      const order = priceOnlineOrder(online, storefront, cart(rand, method === "ship" ? shippable : ITEMS), method);
      const first = oneOf(rand, FIRST);
      const last = oneOf(rand, LAST);
      const buyerName = `${first} ${last}`;
      // Orders from the last two days are still waiting for the seller. Older ones went out.
      const pending = daysAgo <= 1;
      let fulfillment = order.fulfillment;
      if (fulfillment.method === "ship") {
        const place = pick(rand, places);
        const address: PostalAddress = {
          line1: `${between(rand, 12, 4980)} ${oneOf(rand, STREETS)}`,
          ...(rand() < 0.2 ? { line2: `Apt ${between(rand, 1, 40)}` } : {}),
          city: place.city,
          region: place.region,
          postalCode: place.postal(),
          country: place.country,
        };
        const carrier = pick(rand, CARRIERS).carrier;
        fulfillment = pending
          ? { method: "ship", status: "to_ship", recipient: buyerName, address }
          : {
              method: "ship",
              status: "shipped",
              recipient: buyerName,
              address,
              carrier,
              tracking: tracking(rand, carrier),
              shippedAt: past(paidAt.getTime() + between(rand, 14, 40) * 3_600_000),
            };
      } else {
        fulfillment = pending
          ? { method: "pickup", status: "to_collect" }
          : { method: "pickup", status: "collected", collectedAt: past(paidAt.getTime() + between(rand, 1, 6) * 86_400_000) };
      }
      record(
        paidAt,
        {
          lines: order.lines,
          totalCents: order.totalCents,
          channel: "online",
          shippingCents: order.shippingCents,
          fulfillment,
          buyerName: `${first} ${last[0]}.`,
        },
        daysAgo,
      );
    }
  }

  sales.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { local: stand, online, storefront, sales };
}
