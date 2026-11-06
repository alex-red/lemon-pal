import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { between, FIRST, LAST, localTime, mulberry32, oneOf, pick, type Rand } from "./demo-stickers";
import { cleanNote, defaultDonation, donationLine } from "./donations";
import { env } from "./env";
import type { Cents } from "./money";
import type { DonationSettings, Sale, Stand, Storefront } from "./types";

/*
 * The fundraiser demo: a donation stand for Maple Hollow Animal Rescue's winter drive. Three weeks of gifts from
 * the online page and from two Saturday adoption days at the stand, with donors' notes, so the poster, its goal bar,
 * the notes list and the recap all have something to show. The rescue, the donors and every gift are made up. No
 * gift went through PayPal: each one carries `demo: true`, so refunds for it stay local.
 */

/** Each demo account's page gets this handle plus a short tag of its own, like keep-maple-hollow-warm-3f2a. */
export const FUNDRAISER_SLUG = "keep-maple-hollow-warm";
const DAYS = 21;
const GOAL_CENTS = 500_000;

export const FUNDRAISER_SETTINGS: DonationSettings = {
  ...defaultDonation(),
  presetsCents: [1000, 2500, 5000],
  minCents: 100,
  maxCents: 50_000,
  buttonLabel: "Donate",
  thanks: "Thank you! You just kept a dog or cat warm tonight.",
  goalCents: GOAL_CENTS,
};

const TITLE = "Keep Maple Hollow Warm";
const INTRO =
  "Maple Hollow Animal Rescue cares for 40 dogs and cats waiting for homes. This winter we need blankets, food and heat for the kennels.\n" +
  "$10 feeds a dog for a week. $25 covers a vaccine. $50 keeps a kennel warm for a month.";

// Notes donors left. They go through cleanNote like real ones, so a sweary one comes out masked.
const NOTES = [
  "For Biscuit, who we adopted from you last spring 🐶",
  "Go Maple Hollow!",
  "In memory of Pepper, the best cat. Give someone a warm bed.",
  "My kids saved their allowance for this.",
  "Thank you for everything you do.",
  "From the 3rd grade bake sale table!",
  "Blankets for the puppies please",
  "Adopted Juniper here 3 years ago. Still the goodest girl.",
  "Keep up the amazing work!",
  "Happy holidays to all the volunteers",
  "Saw the post about the heater. Hope this helps.",
  "For the senior dogs ❤️",
  "Our office matched this one",
  "Loved the adoption day. You guys are fucking amazing",
  "Hi from the coffee shop next door ☕",
  "In honor of my grandma, who never met a stray she didn't feed",
  "Cat tax paid 🐈",
  "So glad Mochi found a home!",
  "Small but mighty",
  "Warm paws, warm hearts",
];

// Notes the seller hid from the poster: harmless, but not what the display is for.
const HIDDEN_NOTES = ["first!!!!!", "is this the place to complain about parking"];

/** Gift sizes online: mostly the buttons, sometimes a typed amount, and now and then a big one. */
const ONLINE_AMOUNTS: { cents: Cents | "odd" | "big"; weight: number }[] = [
  { cents: 1000, weight: 30 },
  { cents: 2500, weight: 34 },
  { cents: 5000, weight: 16 },
  { cents: "odd", weight: 16 },
  { cents: "big", weight: 4 },
];
const ODD = [500, 700, 1500, 2000, 3000, 4000, 7500];
const BIG = [10_000, 15_000, 20_000, 25_000];
// Typed at the stand on adoption days: round, smaller amounts, often what was in someone's pocket.
const STAND_AMOUNTS = [300, 500, 500, 1000, 1000, 1000, 2000, 2000, 2500, 5000];

export type FundraiserDemo = { stand: Stand; storefront: Storefront; sales: Sale[] };
export type FundraiserTarget = { ownerId: string; standId: string; slug: string };

/** Builds the whole demo. Pure apart from reading the banner, so it can be checked on its own. */
export async function buildFundraiserDemo(
  target: FundraiserTarget,
  options: { now?: Date; tzOffsetMinutes?: number } = {},
): Promise<FundraiserDemo> {
  const now = options.now ?? new Date();
  const tz = options.tzOffsetMinutes ?? 0;
  const rand = mulberry32(20261231);
  // The photo is optional: without it the poster falls back to its berry wash.
  const banner = await readFile(path.join(process.cwd(), "public/demo/shelter-banner.jpg")).catch(() => null);

  const stand: Stand = {
    id: target.standId,
    ownerId: target.ownerId,
    kind: "donation",
    name: "Maple Hollow Winter Drive",
    currency: env.currency(),
    items: [],
    publishedAt: localTime(now, DAYS, 9 * 60, tz).toISOString(),
    setupStartedAt: null,
    draftStartedAt: null,
  };
  const storefront: Storefront = {
    standId: stand.id,
    slug: target.slug,
    title: TITLE,
    intro: INTRO,
    ...(banner ? { banner: `data:image/jpeg;base64,${banner.toString("base64")}` } : {}),
    accent: "berry",
    open: true,
    pickup: false,
    pickupNote: "",
    shipping: { enabled: false, flatRateCents: 0, freeOverCents: null, countries: [] },
    donation: FUNDRAISER_SETTINGS,
    updatedAt: now.toISOString(),
  };

  const sales: Sale[] = [];
  let n = 0;
  // Notes come round in a shuffled order, so the same one never turns up twice close together.
  const notes = shuffled(rand, NOTES);
  let noteIndex = 0;
  const nextNote = () => cleanNote(notes[noteIndex++ % notes.length]).note;
  let hiddenLeft = [...HIDDEN_NOTES];
  const nowMinutes = (() => {
    const wall = new Date(now.getTime() - tz * 60_000);
    return wall.getUTCHours() * 60 + wall.getUTCMinutes();
  })();

  function gift(paidAt: Date, amountCents: Cents, extra: { buyerName?: string; note?: string; noteHidden?: boolean; refunded?: boolean }) {
    n += 1;
    const paid = paidAt.toISOString();
    sales.push({
      id: crypto.randomUUID(),
      standId: stand.id,
      currency: stand.currency,
      lines: [donationLine(FUNDRAISER_SETTINGS, amountCents)],
      totalCents: amountCents,
      status: extra.refunded ? "refunded" : "paid",
      paypalOrderId: `DEMO-ORDER-${n}`,
      paypalCaptureId: `DEMO-CAPTURE-${n}`,
      createdAt: new Date(paidAt.getTime() - between(rand, 30, 120) * 1000).toISOString(),
      paidAt: paid,
      channel: "donation",
      ...(extra.buyerName ? { buyerName: extra.buyerName } : {}),
      ...(extra.note ? { note: extra.note } : {}),
      ...(extra.noteHidden ? { noteHidden: true } : {}),
      ...(extra.refunded
        ? { refund: { paypalRefundId: `DEMO-REFUND-${n}`, refundedAt: new Date(Math.min(paidAt.getTime() + 3_600_000, now.getTime() - 60_000)).toISOString() } }
        : {}),
      demo: true,
    });
  }

  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
    const day = localTime(now, daysAgo, 0, tz);
    const weekday = new Date(day.getTime() - tz * 60_000).getUTCDay();
    const latest = daysAgo === 0 ? Math.max(nowMinutes - 3, 0) : 24 * 60 - 1;
    const at = (minutes: number) => (minutes <= latest ? localTime(now, daysAgo, minutes, tz) : null);
    // The drive builds: a slow first week, then word spreads. Weekends and the last few days are busiest.
    const momentum = 1 + (DAYS - daysAgo) / DAYS;

    // Online: a steady stream, mostly evenings, after people see the post.
    const online = Math.round(between(rand, 2, 5) * momentum) + (weekday === 0 ? 2 : 0) + (daysAgo === 0 ? 3 : 0);
    for (let i = 0; i < online; i++) {
      const minutes = daysAgo === 0 ? between(rand, Math.max(latest - 300, 0), latest) : rand() < 0.65 ? between(rand, 18 * 60, 23 * 60) : between(rand, 7 * 60, 18 * 60);
      const paidAt = at(minutes);
      if (!paidAt) continue;
      const size = pick(rand, ONLINE_AMOUNTS).cents;
      const amount = size === "odd" ? oneOf(rand, ODD) : size === "big" ? oneOf(rand, BIG) : size;
      const name = `${oneOf(rand, FIRST)} ${oneOf(rand, LAST)}`;
      // About two in five leave a note. The hidden ones came in yesterday and last week, so the editor's recent
      // notes show one the seller already hid.
      let note: string | undefined;
      let noteHidden = false;
      if (hiddenLeft.length && (daysAgo === 1 || daysAgo === 6) && i === 1) {
        note = hiddenLeft[0];
        hiddenLeft = hiddenLeft.slice(1);
        noteHidden = true;
      } else if (rand() < 0.4) {
        note = nextNote();
      }
      // One donor typed 500 meaning 50, and the rescue refunded it.
      const refunded = daysAgo === 9 && i === 0;
      gift(paidAt, refunded ? 50_000 : amount, { buyerName: name, note, noteHidden, refunded });
    }

    // Adoption days at the stand, two Saturdays ago and last Saturday: a busy table, gifts typed in on the display.
    if (weekday === 6 && daysAgo > 0 && daysAgo < 15) {
      const count = between(rand, 18, 28);
      for (let i = 0; i < count; i++) {
        const paidAt = at(10 * 60 + Math.floor(((rand() + rand()) / 2) * 5 * 60));
        if (!paidAt) continue;
        // Half scanned the poster and gave on their phone, so PayPal sent a name. The rest were typed in.
        const scanned = rand() < 0.5;
        gift(paidAt, oneOf(rand, scanned ? [1000, 1000, 2500, 2500, 5000] : STAND_AMOUNTS), {
          ...(scanned ? { buyerName: `${oneOf(rand, FIRST)} ${oneOf(rand, LAST)}` } : {}),
          ...(scanned && rand() < 0.3 ? { note: nextNote() } : {}),
        });
      }
    }
  }

  // Land just short of the goal, so the bar looks close and the live gifts in a demo push it toward the line.
  const raised = () => sales.filter((s) => s.status === "paid").reduce((sum, s) => sum + s.totalCents, 0);
  const target86 = Math.round(GOAL_CENTS * 0.86);
  while (raised() > target86) {
    // Drop the oldest small gifts until the total fits.
    const index = sales.findIndex((s) => s.status === "paid" && s.totalCents <= 2500);
    if (index < 0) break;
    sales.splice(index, 1);
  }
  sales.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { stand, storefront, sales };
}

function shuffled<T>(rand: Rand, list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** A gift for the "Simulate a gift" button: one of the preset amounts, a donor's first name, and maybe a note. */
export function simulatedGift(stand: Stand, settings: DonationSettings): Sale {
  const rand = Math.random;
  const amounts = settings.presetsCents.length ? settings.presetsCents : [Math.max(settings.minCents, 1000)];
  const amount = oneOf(rand, amounts);
  const now = Date.now();
  const id = crypto.randomUUID();
  const note = settings.notes && rand() < 0.6 ? cleanNote(oneOf(rand, NOTES)).note : undefined;
  return {
    id,
    standId: stand.id,
    currency: stand.currency,
    lines: [donationLine(settings, amount)],
    totalCents: amount,
    status: "paid",
    paypalOrderId: `DEMO-ORDER-${id.slice(0, 8)}`,
    paypalCaptureId: `DEMO-CAPTURE-${id.slice(0, 8)}`,
    createdAt: new Date(now - 40_000).toISOString(),
    paidAt: new Date(now).toISOString(),
    channel: "donation",
    buyerName: `${oneOf(rand, FIRST)} ${oneOf(rand, LAST)}`,
    ...(note ? { note } : {}),
    demo: true,
  };
}
