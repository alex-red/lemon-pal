import "server-only";
import { env } from "./env";
import { store } from "./store";
import type { Stand } from "./types";

export const DEMO_STAND_ID = "demo";

/** Sample catalog for local development and the judge demo's reset action. */
export function demoStand(): Stand {
  return {
    id: DEMO_STAND_ID,
    name: "Lemonade Stand",
    currency: env.currency(),
    publishedAt: new Date().toISOString(),
    items: [
      { id: "lemonade", name: "Lemonade", priceCents: 300 },
      { id: "cookie", name: "Cookie", priceCents: 150 },
      { id: "sticker", name: "Sticker", priceCents: 200 },
    ],
  };
}

export async function getOrCreateDemoStand(): Promise<Stand> {
  const existing = await store.getStand(DEMO_STAND_ID);
  if (existing) return existing;
  const stand = demoStand();
  await store.saveStand(stand);
  return stand;
}
