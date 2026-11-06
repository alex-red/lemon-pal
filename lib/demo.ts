import "server-only";
import { randomBytes } from "node:crypto";
import { buildStickerDemo, STICKER_SLUG } from "./demo-stickers";
import { env } from "./env";
import { kindOf } from "./stands";
import { SlugTakenError, store } from "./store";
import type { CatalogItem, Stand, StandKind, User } from "./types";

/** A demo account unused for this long is deleted, along with its stands and sales. */
export const DEMO_ACCOUNT_DAYS = 30;

type Sample = { name: string; emoji: string; items: CatalogItem[] };

/** Ready-made stands that show Lemon Pal works for anything. The first is the default and the reset target. */
const SAMPLES = {
  lemonade: {
    name: "Lemonade Stand",
    emoji: "🍋",
    items: [
      { id: "lemonade", name: "Lemonade", priceCents: 300, emoji: "🍋" },
      { id: "cookie", name: "Cookie", priceCents: 150, emoji: "🍪" },
      { id: "sticker", name: "Sticker", priceCents: 200, emoji: "⭐", ships: true },
    ],
  },
  "bake-sale": {
    name: "School Bake Sale",
    emoji: "🧁",
    items: [
      { id: "cupcake", name: "Cupcake", priceCents: 250, emoji: "🧁" },
      { id: "brownie", name: "Brownie", priceCents: 200, emoji: "🍫" },
      { id: "banana-bread", name: "Banana bread", priceCents: 400, emoji: "🍌" },
      { id: "cookie", name: "Cookie", priceCents: 100, emoji: "🍪" },
    ],
  },
  merch: {
    name: "Merch Table",
    emoji: "🎨",
    items: [
      { id: "print", name: "Art print", priceCents: 2000, emoji: "🖼️", ships: true },
      { id: "sticker-pack", name: "Sticker pack", priceCents: 800, emoji: "✨", ships: true },
      { id: "pin", name: "Enamel pin", priceCents: 1200, emoji: "📍", ships: true },
      { id: "tote", name: "Tote bag", priceCents: 2500, emoji: "👜", ships: true },
    ],
  },
  "garage-sale": {
    name: "Garage Sale",
    emoji: "🏷️",
    items: [
      { id: "books", name: "Books", priceCents: 100, emoji: "📚" },
      { id: "lamp", name: "Lamp", priceCents: 1500, emoji: "💡" },
      { id: "board-game", name: "Board game", priceCents: 500, emoji: "🎲" },
      { id: "plant", name: "Plant", priceCents: 800, emoji: "🪴" },
    ],
  },
} satisfies Record<string, Sample>;

export type SampleId = keyof typeof SAMPLES;

export function isSampleId(id: string | null): id is SampleId {
  return id !== null && Object.hasOwn(SAMPLES, id);
}

/** Names and emoji of the samples, for the setup screen. */
export const sampleChoices = Object.entries(SAMPLES).map(([id, { name, emoji }]) => ({ id: id as SampleId, name, emoji }));

/** The sample each kind of stand goes back to on Reset demo. */
const KIND_SAMPLE: Record<StandKind, SampleId> = { local: "lemonade", online: "merch" };

/** A stand loaded with a sample catalog, for the setup screen's samples and Reset demo. Keeps the stand's id, owner and kind. */
export function sampleStand(sample: SampleId, base: Pick<Stand, "id" | "ownerId" | "kind">): Stand {
  const { name, items } = SAMPLES[sample];
  return {
    id: base.id,
    ownerId: base.ownerId,
    kind: base.kind ?? "local",
    name,
    currency: env.currency(),
    publishedAt: new Date().toISOString(),
    items,
  };
}

/** The sample a stand of this kind resets to. */
export function kindSample(kind: StandKind): SampleId {
  return KIND_SAMPLE[kind];
}

/** Puts a stand back to its sample and deletes its sales. An online stand keeps its store and handle. */
export async function resetStand(stand: Stand): Promise<Stand> {
  const kind = kindOf(stand);
  const fresh = sampleStand(kindSample(kind), { id: stand.id, ownerId: stand.ownerId, kind });
  await store.saveStand(fresh);
  await store.clearSales(stand.id);
  return fresh;
}

/** A short random tag, to tell demo accounts and their store handles apart. */
const tag = (bytes: number) => randomBytes(bytes).toString("hex");

/**
 * Makes a new demo account for one person, loaded with the sticker shop: a stand at events and an online store,
 * each with a month of made-up sales. Unused demo accounts are cleared out first.
 */
export async function createDemoAccount(options: { tzOffsetMinutes?: number } = {}): Promise<User> {
  await store.purgeDemoUsers(new Date(Date.now() - DEMO_ACCOUNT_DAYS * 86_400_000).toISOString());
  const id = `demo-${tag(8)}`;
  const now = new Date().toISOString();
  const user: User = { id, name: `Demo Seller ${id.slice(5, 9).toUpperCase()}`, createdAt: now, demo: true, lastSeenAt: now };
  await store.saveUser(user);
  await loadStickerShop(user, options);
  return user;
}

/**
 * Fills a demo account with the sticker shop: its stand at events (`prefer` if that's one, else its first) gets the
 * market sales, and its online store (likewise) gets the store and the orders. A missing stand of either kind is made.
 * Replaces both stands' items, the store settings and every sale on them. The online store keeps its handle.
 */
export async function loadStickerShop(user: User, options: { tzOffsetMinutes?: number; prefer?: Stand } = {}) {
  const stands = await store.listStands(user.id);
  const pick = (kind: StandKind) =>
    (options.prefer && kindOf(options.prefer) === kind ? options.prefer : stands.find((s) => kindOf(s) === kind))?.id ??
    crypto.randomUUID();
  const localId = pick("local");
  const onlineId = pick("online");
  const kept = (await store.getStorefront(onlineId))?.slug;

  // A new handle is the sticker shop's plus a tag. Try again with another tag on the rare clash.
  for (let attempt = 0; ; attempt += 1) {
    const slug = kept ?? `${STICKER_SLUG}-${tag(attempt < 3 ? 2 : 4)}`;
    const demo = await buildStickerDemo({ ownerId: user.id, localId, onlineId, slug }, { tzOffsetMinutes: options.tzOffsetMinutes });
    // Only the online stand has a store. A local stand from before stands had kinds might still hold one.
    await store.deleteStorefront(localId);
    try {
      await store.saveStorefront(demo.storefront);
    } catch (error) {
      if (error instanceof SlugTakenError && !kept && attempt < 6) continue;
      throw error;
    }
    await Promise.all([store.saveStand(demo.local), store.saveStand(demo.online)]);
    await Promise.all([store.clearSales(localId), store.clearSales(onlineId)]);
    await store.saveSales(demo.sales);
    return demo;
  }
}
