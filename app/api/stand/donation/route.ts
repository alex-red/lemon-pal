import { z } from "zod";
import { LABEL_MAX, MAX_GIFT_CENTS, MAX_PRESETS, settingsProblem, THANKS_MAX } from "@/lib/donations";
import { handleProblem } from "@/lib/handles";
import { requestStand, standNotFound } from "@/lib/session";
import { kindOf } from "@/lib/stands";
import { SlugTakenError, store } from "@/lib/store";
import { draftDonationPage, withoutBanner } from "@/lib/storefront";
import type { Storefront } from "@/lib/types";

const cents = z.number().int().min(0).max(MAX_GIFT_CENTS);

const DonationPageSchema = z.object({
  slug: z.string().trim().toLowerCase(),
  title: z.string().trim().min(1).max(60),
  intro: z.string().trim().max(280),
  // A 3:1 JPEG the editor cropped and shrank. null removes it; leaving it out keeps the current one.
  banner: z
    .string()
    .max(400_000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
    .nullable()
    .optional(),
  accent: z.enum(["lemon", "leaf", "berry"]),
  open: z.boolean(),
  donation: z.object({
    presetsCents: z.array(cents).max(MAX_PRESETS),
    allowCustom: z.boolean(),
    minCents: cents,
    maxCents: cents,
    buttonLabel: z.string().trim().max(LABEL_MAX),
    thanks: z.string().trim().max(THANKS_MAX),
    goalCents: z.number().int().min(100).max(100_000_000).nullable(),
    notes: z.boolean(),
    showNotes: z.boolean(),
  }),
});

/** Saves a donation stand's page and gift settings. The editor calls this as the seller types. */
export async function PUT(request: Request) {
  const parsed = DonationPageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const message =
      field === "title" ? "Give your page a title." : field === "banner" ? "That photo is too big. Try another." : "Some settings couldn’t be saved.";
    return Response.json({ error: message, field }, { status: 400 });
  }
  const input = parsed.data;
  const problem = handleProblem(input.slug);
  if (problem) return Response.json({ error: problem, field: "slug" }, { status: 400 });

  const stand = await requestStand(request);
  if (!stand) return standNotFound();
  if (kindOf(stand) !== "donation") return Response.json({ error: "Only a donation stand has a donation page." }, { status: 409 });

  const donation = { ...input.donation, presetsCents: [...input.donation.presetsCents].sort((a, b) => a - b) };
  const settings = settingsProblem(donation, stand.currency);
  if (settings) return Response.json({ error: settings.message, field: settings.field }, { status: 400 });

  const current = (await store.getStorefront(stand.id)) ?? draftDonationPage(stand);
  const next: Storefront = {
    // A donation page keeps the store record's other fields at their drafts. Nothing reads them for this kind.
    ...draftDonationPage(stand),
    slug: input.slug,
    title: input.title,
    intro: input.intro,
    accent: input.accent,
    open: input.open,
    donation,
    updatedAt: new Date().toISOString(),
  };
  delete next.banner;
  const banner = input.banner === undefined ? current.banner : (input.banner ?? undefined);
  if (banner) next.banner = banner;

  try {
    await store.saveStorefront(next);
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return Response.json({ error: "Another page already has that name.", field: "slug" }, { status: 409 });
    }
    throw error;
  }
  return Response.json({ storefront: withoutBanner(next) });
}
