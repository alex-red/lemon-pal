import "server-only";
import type { Sale, Stand } from "./types";

/** A sign read longer ago than this starts the clock again, so an abandoned draft doesn't count. */
const DRAFT_TTL_MS = 30 * 60 * 1000;

/** Starts the setup clock when the seller reads a sign or list, unless this draft already started it. */
export function startDraft(stand: Stand, now = new Date()): Stand {
  const started = stand.draftStartedAt ? Date.parse(stand.draftStartedAt) : NaN;
  if (now.getTime() - started < DRAFT_TTL_MS) return stand;
  return { ...stand, draftStartedAt: now.toISOString() };
}

/**
 * Time from the start of setup to the first verified payment on the published catalog, in whole seconds.
 * Only sales rung up after publishing count, and only once their capture is verified (status paid).
 */
export function firstSale(stand: Stand, sales: Sale[]): { saleId: string; seconds: number } | null {
  if (!stand.setupStartedAt || !stand.publishedAt) return null;
  const publishedAt = stand.publishedAt;
  const first = sales
    .filter((s): s is Sale & { paidAt: string } => s.status === "paid" && s.paidAt !== null && s.createdAt >= publishedAt)
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))[0];
  if (!first) return null;
  const seconds = Math.round((Date.parse(first.paidAt) - Date.parse(stand.setupStartedAt)) / 1000);
  return seconds >= 0 ? { saleId: first.id, seconds } : null;
}
