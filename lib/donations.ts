// Rules for donation stands, shared by the editor, the donor page and the server. No server-only imports, so client
// components can use the limits and checks too. The server is still the one that enforces them.
import { formatMoney, type Cents } from "./money";
import type { DonationSettings, Sale, SaleLine } from "./types";

/** The smallest gift any donation stand can take. Stops penny card-testing through a public page. */
export const MIN_GIFT_CENTS = 100;
/** The largest gift any donation stand can take, whatever the seller sets. */
export const MAX_GIFT_CENTS = 100_000;
export const MAX_PRESETS = 4;
export const NOTE_MAX = 140;
export const LABEL_MAX = 24;
export const THANKS_MAX = 160;
/** The id of a donation's single line. */
export const DONATION_ITEM_ID = "donation";

/** Settings a new donation stand starts with. */
export function defaultDonation(): DonationSettings {
  return {
    presetsCents: [500, 1000, 2000],
    allowCustom: true,
    minCents: MIN_GIFT_CENTS,
    maxCents: 50_000,
    buttonLabel: "Donate",
    thanks: "Thank you for your support!",
    goalCents: null,
    notes: true,
    showNotes: true,
  };
}

/** Why these settings can't be saved, or null. Presets must be distinct and sit inside min to max. */
export function settingsProblem(settings: DonationSettings, currency: string): { field: string; message: string } | null {
  const { presetsCents: presets, minCents, maxCents } = settings;
  if (minCents < MIN_GIFT_CENTS) return { field: "min", message: `The smallest gift can’t be under ${formatMoney(MIN_GIFT_CENTS, currency)}.` };
  if (maxCents > MAX_GIFT_CENTS) return { field: "max", message: `The largest gift can’t be over ${formatMoney(MAX_GIFT_CENTS, currency)}.` };
  if (minCents > maxCents) return { field: "max", message: "The largest gift has to be more than the smallest." };
  if (presets.length === 0 && !settings.allowCustom) return { field: "presets", message: "Add an amount, or let donors type their own." };
  if (presets.length > MAX_PRESETS) return { field: "presets", message: `Offer up to ${MAX_PRESETS} amounts.` };
  if (new Set(presets).size !== presets.length) return { field: "presets", message: "Each amount should be different." };
  if (presets.some((p) => p < minCents || p > maxCents)) return { field: "presets", message: "Every amount has to be between the smallest and largest gift." };
  if (!settings.buttonLabel.trim()) return { field: "label", message: "Name the button, such as Donate." };
  return null;
}

/** Why a donor can't give this amount, or null. The donation route checks this before it creates a sale. */
export function giftProblem(settings: DonationSettings, amountCents: number, currency: string): string | null {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return "Choose an amount.";
  const isPreset = settings.presetsCents.includes(amountCents);
  if (!isPreset && !settings.allowCustom) return "Choose one of the amounts.";
  if (amountCents < settings.minCents || amountCents > settings.maxCents) {
    return `Choose an amount from ${formatMoney(settings.minCents, currency)} to ${formatMoney(settings.maxCents, currency)}.`;
  }
  return null;
}

/** A donation's one line: the amount the donor chose, once. Named for the button, so PayPal says "Tip" for a tip. */
export function donationLine(settings: Pick<DonationSettings, "buttonLabel">, amountCents: Cents): SaleLine {
  const label = settings.buttonLabel.trim();
  const name = !label || /^donate$/i.test(label) ? "Donation" : label;
  return { itemId: DONATION_ITEM_ID, name, emoji: "💛", unitPriceCents: amountCents, quantity: 1 };
}

/** Sums the paid gifts on a donation stand. Refunded gifts don't count. */
export function raisedCents(sales: Sale[]): { cents: Cents; count: number } {
  const paid = sales.filter((s) => s.channel === "donation" && s.status === "paid");
  return { cents: paid.reduce((sum, s) => sum + s.totalCents, 0), count: paid.length };
}

// Light moderation for a public note. The note shows on the seller's display screen, so it drops anything that
// could send people elsewhere and masks common swearing. The seller can still hide any note by hand.
const LINK = /(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|net|org|io|co|app|xyz|ly|me|gg|info|biz|link|site|online|shop)\b(?:\/\S*)?/gi;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(?:\+?\d[\s().-]?){7,}/g;
const HANDLE = /(^|\s)@[\w.]{2,}/g;
const SWEARS = ["fuck", "shit", "cunt", "bitch", "asshole", "bastard", "dick", "cock", "pussy", "whore", "slut", "wanker", "twat", "prick"];
// Whole words with common endings only, so "Shitake", "cocktail" and "Dickens" stay as written.
const SWEAR = new RegExp(`\\b(?:${SWEARS.join("|")})(?:s|es|ed|er|ers|ing|in|ty|y|head|heads)?\\b`, "gi");

export type CleanNote = { note?: string; error?: string };

/**
 * Cleans a donor's note: strips control characters and extra spaces, refuses links, emails, phone numbers and
 * @handles, and masks swearing. A blank note is no note.
 */
export function cleanNote(text: string | undefined | null): CleanNote {
  if (!text) return {};
  // Control and invisible formatting characters, which can hide text or flip its direction.
  const flat = text.normalize("NFKC").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim();
  if (!flat) return {};
  if (flat.length > NOTE_MAX) return { error: `Keep your note to ${NOTE_MAX} characters.` };
  for (const pattern of [LINK, EMAIL, PHONE, HANDLE]) {
    pattern.lastIndex = 0;
    if (pattern.test(flat)) return { error: "Notes can’t include links, emails, phone numbers or @handles." };
  }
  const note = flat.replace(SWEAR, (word) => word[0] + "•".repeat(word.length - 1));
  return { note };
}

/** A donor's first name only, for the display screen. */
export function firstName(name: string | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first.slice(0, 20) : null;
}
