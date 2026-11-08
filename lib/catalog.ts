import "server-only";
import { z } from "zod";
import { isValidDeal, MAX_DEAL_QUANTITY } from "./deals";
import { cleanEmoji } from "./emoji";
import type { CatalogItem, Stand } from "./types";

export const MAX_ITEMS = 24;

/** One item as the seller confirms it. The setup screen and Pal both publish through this. */
export const ItemInputSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    // The seller confirms every price; nothing unreadable gets through.
    priceCents: z.number().int().min(1).max(100_000),
    emoji: z.string().max(16).optional().transform(cleanEmoji),
    // Accept the setup screen's cropped photo or a bundled demo sticker on catalog edits.
    image: z
      .string()
      .max(120_000)
      .regex(/^(?:data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}|\/demo\/stickers\/[a-z0-9-]+\.webp)$/)
      .optional(),
    deal: z
      .object({
        quantity: z.number().int().min(2).max(MAX_DEAL_QUANTITY),
        priceCents: z.number().int().min(1).max(100_000),
      })
      .optional(),
    soldOut: z.boolean().optional(),
  })
  // A deal that saves nothing is a typo, not a deal.
  .refine((item) => !item.deal || isValidDeal(item.priceCents, item.deal), {
    message: "A deal has to cost less than buying the items one at a time.",
  });

export type ItemInput = z.infer<typeof ItemInputSchema>;

/**
 * Store and recap choices the setup screen doesn't edit. Pal sets them directly. When they're missing, an item keeps
 * the ones its namesake had before.
 */
export type ItemExtras = Pick<CatalogItem, "online" | "ships"> & {
  /** null clears it. */
  category?: string | null;
  finish?: string | null;
};

/** A given value wins, null clears, and a missing one keeps the old value. */
const keep = <T,>(given: T | null | undefined, old: T | undefined): T | undefined =>
  given === undefined ? old : (given ?? undefined);

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The stand with a newly confirmed catalog. Existing sales keep their own line-item snapshots.
 * `update` edits a published stand without restarting its publish time, so the first-sale clock keeps running.
 */
export function withCatalog(
  current: Stand,
  { name, update, items }: { name?: string; update?: boolean; items: (ItemInput & ItemExtras)[] },
): Stand {
  const stamp = Date.now().toString(36);
  return {
    ...current,
    name: name || current.name,
    ...(update && current.publishedAt
      ? {}
      : {
          publishedAt: new Date().toISOString(),
          // The clock runs from the sign read that drafted this catalog. A blank form or an edit without one has none.
          setupStartedAt: current.draftStartedAt ?? null,
          draftStartedAt: null,
        }),
    items: items.map(({ online, ships, category, finish, ...item }, i) => {
      // Item ids change on every publish, so the store's online and shipping choices, and the category
      // and finish the recap groups by, follow the item's name unless they were given.
      const before = current.items.find((old) => sameName(old.name, item.name));
      online = keep(online, before?.online);
      ships = keep(ships, before?.ships);
      const shelf = keep(category, before?.category);
      const made = keep(finish, before?.finish);
      return {
        id: `item-${i + 1}-${stamp}`,
        ...item,
        ...(item.soldOut ? { soldOut: true } : { soldOut: undefined }),
        ...(online !== undefined ? { online } : {}),
        ...(ships !== undefined ? { ships } : {}),
        ...(shelf ? { category: shelf } : {}),
        ...(made ? { finish: made } : {}),
      };
    }),
  };
}
