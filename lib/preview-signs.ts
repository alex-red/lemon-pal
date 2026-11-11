import "server-only";
import type { PreviewSign } from "./ai-preview";
import type { CurrentItem } from "./sign-reader";
import type { DraftItem, SignDraft } from "./types";

/*
 * What the sign reader returns for each bundled demo photo on simulated AI, written to match what Claude reads from
 * them. The art table keeps its smudged price unread, so the review screen still asks for it.
 */
const SIGNS: Record<Exclude<PreviewSign, "restock">, SignDraft> = {
  art: {
    standName: "Art Table",
    items: [
      { name: "Stickers", priceCents: 300, confidence: "high", emoji: "✨", deal: { quantity: 2, priceCents: 500 } },
      { name: "Mini prints", priceCents: null, confidence: "low", emoji: "🖼️" },
      { name: "Postcards", priceCents: 400, confidence: "high", emoji: "💌" },
    ],
  },
  lemonade: {
    standName: null,
    items: [
      { name: "Lemonade", priceCents: 200, confidence: "high", emoji: "🍋" },
      { name: "Pink Lemonade", priceCents: 300, confidence: "high", emoji: "🍹" },
      { name: "Cookies", priceCents: 100, confidence: "high", emoji: "🍪" },
      { name: "Refill", priceCents: 100, confidence: "high", emoji: "🥤" },
    ],
  },
  booth: {
    standName: null,
    items: [
      { name: "Jumbo shark plush", priceCents: 4000, confidence: "high", emoji: "🦈", region: { x: 0, y: 0.07, width: 0.33, height: 0.2 } },
      { name: "Large plush", priceCents: 3500, confidence: "high", emoji: "🧸", region: { x: 0.29, y: 0.1, width: 0.46, height: 0.18 } },
      { name: "Round plush", priceCents: 3000, confidence: "high", emoji: "🧸", region: { x: 0.58, y: 0.43, width: 0.16, height: 0.15 } },
      { name: "Medium plush", priceCents: 2500, confidence: "high", emoji: "🐱", region: { x: 0.24, y: 0.46, width: 0.25, height: 0.15 } },
      { name: "Hanging plush", priceCents: 2000, confidence: "high", emoji: "🐰", region: { x: 0, y: 0.27, width: 0.23, height: 0.7 } },
      { name: "Keychain plush", priceCents: 500, confidence: "high", emoji: "🔑", region: { x: 0.38, y: 0.64, width: 0.16, height: 0.12 } },
      { name: "Name tags", priceCents: 500, confidence: "high", emoji: "🏷️", region: { x: 0.55, y: 0.72, width: 0.35, height: 0.12 } },
    ],
  },
  bakery: {
    standName: null,
    items: [
      { name: "Croissant", priceCents: 400, confidence: "high", emoji: "🥐", region: { x: 0.1, y: 0.27, width: 0.28, height: 0.19 } },
      { name: "Mixed Berry Danish", priceCents: 525, confidence: "high", emoji: "🫐", region: { x: 0.37, y: 0.3, width: 0.25, height: 0.1 } },
      { name: "Almond Croissant", priceCents: 575, confidence: "high", emoji: "🥐", region: { x: 0.61, y: 0.29, width: 0.2, height: 0.12 } },
      { name: "Cheddar Chive Scone", priceCents: 475, confidence: "high", emoji: "🧀", region: { x: 0.08, y: 0.59, width: 0.32, height: 0.19 } },
      { name: "Blueberry Muffin", priceCents: 450, confidence: "high", emoji: "🧁", region: { x: 0.37, y: 0.5, width: 0.25, height: 0.19 } },
      { name: "Cranberry Orange Muffin", priceCents: 450, confidence: "high", emoji: "🍊", region: { x: 0.6, y: 0.48, width: 0.25, height: 0.15 } },
      { name: "Lemon Square", priceCents: 425, confidence: "high", emoji: "🍋", region: { x: 0.83, y: 0.49, width: 0.16, height: 0.1 } },
      { name: "Apple Turnover", priceCents: 475, confidence: "high", emoji: "🍎", region: { x: 0.47, y: 0.77, width: 0.38, height: 0.15 } },
      { name: "Raspberry Turnover", priceCents: 475, confidence: "high", emoji: "🍓", region: { x: 0.82, y: 0.71, width: 0.17, height: 0.13 } },
    ],
  },
};

/**
 * The setup screen's restock note, read: the first item costs a dollar more, the second is sold out, the last is
 * left off when there are more than three, and a grab bag is new. Matches the note the screen writes.
 */
function restock(current: CurrentItem[]): SignDraft {
  const kept = current.length > 3 ? current.slice(0, -1) : current;
  return {
    standName: null,
    items: [
      ...kept.map((item, i): DraftItem => ({
        name: item.name,
        priceCents: i === 0 ? item.priceCents + 100 : item.priceCents,
        confidence: "high",
        ...(i === 1 ? { soldOut: true } : {}),
      })),
      { name: "Mystery grab bag", priceCents: 500, confidence: "high", emoji: "🎁" },
    ],
  };
}

/** How long a simulated read takes, so the screen's reading glow still shows. */
const READ_MS = 1200;

/**
 * A demo photo's read on simulated AI. Like the real reader, each line names the current item it matches, here by
 * name, so updating a stand from a demo photo still shows what changed.
 */
export async function readPreviewSign(sign: PreviewSign, current: CurrentItem[] = []): Promise<SignDraft> {
  await new Promise((resolve) => setTimeout(resolve, READ_MS));
  const unclaimed = new Map(current.map((item) => [item.name.trim().toLowerCase(), item.name]));
  const { standName, items } = sign === "restock" ? restock(current) : SIGNS[sign];
  return {
    standName,
    items: items.map((item): DraftItem => {
      const key = item.name.toLowerCase();
      const existingName = unclaimed.get(key);
      unclaimed.delete(key);
      return existingName ? { ...item, existingName } : { ...item };
    }),
  };
}
