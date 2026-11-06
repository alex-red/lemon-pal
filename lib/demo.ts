import "server-only";
import { env } from "./env";
import { store } from "./store";
import type { CatalogItem, Stand } from "./types";

export const DEMO_STAND_ID = "demo";

type Sample = { name: string; emoji: string; items: CatalogItem[] };

/** Ready-made stands that show LemonPal works for anything. The first is the default and the reset target. */
const SAMPLES = {
  lemonade: {
    name: "Lemonade Stand",
    emoji: "🍋",
    items: [
      { id: "lemonade", name: "Lemonade", priceCents: 300, emoji: "🍋" },
      { id: "cookie", name: "Cookie", priceCents: 150, emoji: "🍪" },
      { id: "sticker", name: "Sticker", priceCents: 200, emoji: "⭐" },
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
      { id: "print", name: "Art print", priceCents: 2000, emoji: "🖼️" },
      { id: "sticker-pack", name: "Sticker pack", priceCents: 800, emoji: "✨" },
      { id: "pin", name: "Enamel pin", priceCents: 1200, emoji: "📍" },
      { id: "tote", name: "Tote bag", priceCents: 2500, emoji: "👜" },
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

/** A sample catalog for local development, the setup screen and the judge demo's reset action. */
export function demoStand(sample: SampleId = "lemonade"): Stand {
  const { name, items } = SAMPLES[sample];
  return {
    id: DEMO_STAND_ID,
    name,
    currency: env.currency(),
    publishedAt: new Date().toISOString(),
    items,
  };
}

export async function getOrCreateDemoStand(): Promise<Stand> {
  const existing = await store.getStand(DEMO_STAND_ID);
  if (existing) return existing;
  const stand = demoStand();
  await store.saveStand(stand);
  return stand;
}
