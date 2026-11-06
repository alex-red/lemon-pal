import "server-only";
import { env } from "./env";
import { DEMO_USER_ID } from "./session-token";
import { kindOf } from "./stands";
import { SlugTakenError, store } from "./store";
import { draftStorefront } from "./storefront";
import type { CatalogItem, Stand, StandKind, Storefront, User } from "./types";

/** The demo user's stands. Seeding only: seller routes take their stand from the session. */
export const DEMO_STAND_ID = "demo";
export const DEMO_ONLINE_STAND_ID = "demo-online";
/** The demo shop's public address, at /<handle>. */
export const DEMO_STORE_HANDLE = "demo-shop";

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

/** The sample each kind of demo stand starts from, and goes back to on Reset demo. */
const KIND_SAMPLE: Record<StandKind, SampleId> = { local: "lemonade", online: "merch" };

/**
 * A stand loaded with a sample catalog, for the setup screen's samples and the judge demo's reset.
 * `base` keeps the stand's id, owner and kind; without it this is the demo user's local stand.
 */
export function sampleStand(sample: SampleId, base?: Pick<Stand, "id" | "ownerId" | "kind">): Stand {
  const { name, items } = SAMPLES[sample];
  return {
    id: base?.id ?? DEMO_STAND_ID,
    ownerId: base?.ownerId ?? DEMO_USER_ID,
    kind: base?.kind ?? "local",
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

/** The demo shop's store: open, with pickup and shipping, so a judge can order from it straight away. */
function demoStorefront(stand: Stand): Storefront {
  const draft = draftStorefront(stand);
  return {
    ...draft,
    slug: DEMO_STORE_HANDLE,
    title: stand.name,
    intro: "Prints, stickers and pins from the demo stand. Pick up at the next market or have them posted.",
    accent: "berry",
    open: true,
    pickupNote: "At the Lemon Pal booth on market days",
    shipping: { ...draft.shipping, enabled: true },
  };
}

/** Puts a stand back to its sample and deletes its sales. An online stand's store reopens with the demo settings. */
export async function resetStand(stand: Stand): Promise<Stand> {
  const kind = kindOf(stand);
  const fresh = sampleStand(kindSample(kind), { id: stand.id, ownerId: stand.ownerId, kind });
  await store.saveStand(fresh);
  await store.clearSales(stand.id);
  if (kind === "online" && stand.id === DEMO_ONLINE_STAND_ID) await saveDemoStorefront(fresh);
  return fresh;
}

async function saveDemoStorefront(stand: Stand) {
  try {
    await store.saveStorefront(demoStorefront(stand));
  } catch (error) {
    // Someone already took the demo handle for another stand. The seller can name this store in the editor.
    if (!(error instanceof SlugTakenError)) throw error;
  }
}

/**
 * Makes sure the demo user and its two stands exist: a local stand for the register and an online shop.
 * A stand saved before accounts existed joins the demo user as its local stand, keeping its catalog and sales.
 */
export async function ensureDemoUser(): Promise<User> {
  const existing = await store.getUser(DEMO_USER_ID);
  if (existing) return existing;

  const user: User = { id: DEMO_USER_ID, name: "Demo Seller", createdAt: new Date().toISOString() };
  const local = await store.getStand(DEMO_STAND_ID);
  await store.saveStand(local ? { ...local, ownerId: user.id, kind: kindOf(local) } : sampleStand(kindSample("local")));
  if (!(await store.getStand(DEMO_ONLINE_STAND_ID))) {
    const online = sampleStand(kindSample("online"), { id: DEMO_ONLINE_STAND_ID, ownerId: user.id, kind: "online" });
    // Everything in the merch sample can be posted, so shipping works on the first order.
    await store.saveStand(online);
    await saveDemoStorefront(online);
  }
  await store.saveUser(user);
  return user;
}
