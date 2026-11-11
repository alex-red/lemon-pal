import type { StandKind } from "./types";

/*
 * Real AI (Claude reading any sign, Pal answering anything, Booth Analyst) needs the seller passcode. Without it, a
 * demo account runs on simulated AI: the bundled demo signs read from fixed answers, and Pal runs the requests below
 * through its real tools without calling Claude. Shared by the server and the browser.
 */

/** The name judges see for the passcode, as set on the server. */
export const PASSCODE_NAME = "SELLER_PASSCODE";

/** Short label for anything running on simulated AI. */
export const SIMULATED_AI = "Simulated AI";

/** The sentence every locked place shows, so the way to real AI reads the same everywhere. */
export const UNLOCK_HINT = `Enter the seller passcode (${PASSCODE_NAME}) on the sign-in page to use real AI.`;

/** The sign-in page, coming back to `next` once real AI is unlocked. */
export const unlockHref = (next: string) => `/stand/unlock?ai=1&next=${encodeURIComponent(next)}`;

/**
 * What the sign reader reads without real AI: the setup screen's bundled demo photos, and its restock-note demo
 * ("restock"), which changes the stand's own items.
 */
export const PREVIEW_SIGNS = ["art", "lemonade", "booth", "bakery", "restock"] as const;
export type PreviewSign = (typeof PREVIEW_SIGNS)[number];

export function isPreviewSign(id: unknown): id is PreviewSign {
  return typeof id === "string" && (PREVIEW_SIGNS as readonly string[]).includes(id);
}

/** Requests Pal runs on simulated AI, by the kinds of stand they suit. */
export const PAL_PRESETS = [
  { id: "today", label: "How’s today going?", kinds: ["local", "online", "donation"] },
  { id: "best", label: "What’s selling best?", kinds: ["local", "online"] },
  { id: "sold-out", label: "Mark something sold out", kinds: ["local", "online"] },
  { id: "deal", label: "Add a 2 for $5 deal", kinds: ["local", "online"] },
  { id: "close-store", label: "Close or open the store", kinds: ["online"] },
  { id: "shipping", label: "What needs shipping?", kinds: ["online"] },
  { id: "notes", label: "Read me the latest notes", kinds: ["donation"] },
  { id: "goal", label: "Set a $500 goal", kinds: ["donation"] },
  { id: "refund", label: "Refund the last sale", kinds: ["local", "online", "donation"] },
] as const satisfies readonly { id: string; label: string; kinds: readonly StandKind[] }[];

export type PalPreset = (typeof PAL_PRESETS)[number]["id"];

export function presetsFor(kind: StandKind) {
  return PAL_PRESETS.filter((preset) => (preset.kinds as readonly StandKind[]).includes(kind));
}

export function isPalPreset(id: unknown): id is PalPreset {
  return typeof id === "string" && PAL_PRESETS.some((preset) => preset.id === id);
}
