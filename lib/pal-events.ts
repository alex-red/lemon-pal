/** What Pal, the stand assistant, sends the browser while it works. Safe in client code. */
import type { ShippingCarrier } from "./types";

/** The seller screen Pal is opened from, so it knows what "this" means. */
export const PAL_SCREENS = ["register", "setup", "recap", "orders", "store", "jar", "other"] as const;
export type PalScreen = (typeof PAL_SCREENS)[number];

/** A change Pal made, shown as a card with an Undo button. */
export type PalChange = {
  id: string;
  title: string;
  lines: { label: string; before?: string; after?: string }[];
  undoable: boolean;
};

/**
 * Something Pal won't do by itself because it moves money, reaches outside Lemon Pal or can't be taken back. The
 * browser runs it through the app's own route only when the seller taps the confirm button.
 */
export type PalAction =
  | { kind: "refund"; saleId: string }
  | { kind: "ship"; saleId: string; carrier: ShippingCarrier; carrierName?: string; tracking?: string }
  | { kind: "collect"; saleId: string }
  | { kind: "delete_stand"; standId: string };

/** A card asking the seller to confirm a PalAction. */
export type PalProposal = {
  id: string;
  title: string;
  lines: PalChange["lines"];
  /** The confirm button's words, such as "Refund $4.00". */
  confirm: string;
  /** Can't be taken back, so the button is red. */
  danger: boolean;
  action: PalAction;
};

/** How a proposal ended, told back to Pal so it knows on the next message. */
export type PalOutcome = "done" | "declined" | "failed";

/** One line of the NDJSON stream from POST /api/stand/pal. */
export type PalEvent =
  /** What Pal is doing right now, shown as shimmering text. */
  | { type: "status"; text: string }
  /** More of Pal's answer. */
  | { type: "text"; delta: string }
  /** Pal changed the stand. The page should refresh. */
  | { type: "change"; change: PalChange }
  /** Pal asks the seller to confirm an action. */
  | { type: "proposal"; proposal: PalProposal }
  /** Pal hands a question to Booth Analyst, the recap's charting assistant, for the seller to send. */
  | { type: "handoff"; prompt: string }
  /** Pal wants to open another seller screen once it has finished answering. */
  | { type: "navigate"; href: string }
  | { type: "error"; message: string }
  | { type: "done" };
