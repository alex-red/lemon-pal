import { z } from "zod";
import { handleProblem } from "@/lib/handles";
import { requestStand, standNotFound } from "@/lib/session";
import { SlugTakenError, store } from "@/lib/store";
import { draftStorefront, withoutBanner } from "@/lib/storefront";
import { kindOf } from "@/lib/stands";
import type { Storefront } from "@/lib/types";

const cents = (max: number) => z.number().int().min(0).max(max);

const StorefrontSchema = z.object({
  slug: z.string().trim().toLowerCase(),
  title: z.string().trim().min(1).max(60),
  intro: z.string().trim().max(280),
  // A 3:1 JPEG the editor cropped and shrank. null removes the banner; leaving it out keeps the current one.
  banner: z
    .string()
    .max(400_000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
    .nullable()
    .optional(),
  accent: z.enum(["lemon", "leaf", "berry"]),
  open: z.boolean(),
  pickup: z.boolean(),
  pickupNote: z.string().trim().max(120),
  shipping: z.object({
    enabled: z.boolean(),
    flatRateCents: cents(100_000),
    freeOverCents: cents(1_000_000).nullable(),
    countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(30),
  }),
  // Which catalog items sell online and which ship. Stored on the items, so the register and setup see them too.
  items: z.array(z.object({ id: z.string(), online: z.boolean(), ships: z.boolean() })).max(24),
});

/** Saves the seller's store settings. The editor calls this as the seller types, so every save is whole and valid. */
export async function PUT(request: Request) {
  const parsed = StorefrontSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "");
    const message =
      field === "title" ? "Give your store a title." : field === "banner" ? "That banner photo is too big. Try another." : "Some settings couldn’t be saved.";
    return Response.json({ error: message, field }, { status: 400 });
  }
  const input = parsed.data;
  const problem = handleProblem(input.slug);
  if (problem) return Response.json({ error: problem, field: "slug" }, { status: 400 });
  if (input.shipping.enabled && input.shipping.countries.length === 0) {
    return Response.json({ error: "Add at least one country you ship to.", field: "countries" }, { status: 400 });
  }
  if (input.open && !input.pickup && !input.shipping.enabled) {
    return Response.json({ error: "Turn on pickup or shipping before taking orders.", field: "open" }, { status: 400 });
  }

  const stand = await requestStand(request);
  if (!stand) return standNotFound();
  if (kindOf(stand) !== "online") return Response.json({ error: "Only an online stand has a store." }, { status: 409 });
  const current = (await store.getStorefront(stand.id)) ?? draftStorefront(stand);
  const flags = new Map(input.items.map((item) => [item.id, item]));
  const items = stand.items.map((item) => {
    const flag = flags.get(item.id);
    return flag ? { ...item, online: flag.online, ships: flag.ships } : item;
  });
  if (input.open && !items.some((item) => item.online !== false && (input.pickup || (input.shipping.enabled && item.ships)))) {
    return Response.json({ error: "Choose at least one item to sell online first.", field: "open" }, { status: 400 });
  }

  const next: Storefront = {
    standId: stand.id,
    slug: input.slug,
    title: input.title,
    intro: input.intro,
    accent: input.accent,
    open: input.open,
    pickup: input.pickup,
    pickupNote: input.pickupNote,
    shipping: input.shipping,
    updatedAt: new Date().toISOString(),
  };
  const banner = input.banner === undefined ? current.banner : (input.banner ?? undefined);
  if (banner) next.banner = banner;

  try {
    await store.saveStorefront(next);
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return Response.json({ error: "Another store already has that name.", field: "slug" }, { status: 409 });
    }
    throw error;
  }
  await store.saveStand({ ...stand, items });
  return Response.json({ storefront: withoutBanner(next) });
}
