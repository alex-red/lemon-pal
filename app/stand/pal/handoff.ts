// Pal hands chart questions to Booth Analyst, the recap's Studio assistant. Studio loads only on the recap screen
// (and late), so a question waits here until the recap's Studio is ready to take it. Kept apart from AG Studio, so
// Pal's chat doesn't load it.

/** Screens where the recap shows Studio in view mode, which has no assistant. recap-studio.tsx uses the same query. */
export const PHONE_QUERY = "(max-width: 39.99rem), (orientation: landscape) and (max-height: 34rem)";

let pending: string | null = null;
const listeners = new Set<() => void>();

/** Queues a question for Booth Analyst. A newer one replaces an older one still waiting. */
export function handOff(prompt: string) {
  pending = prompt;
  for (const listener of listeners) listener();
}

/** The waiting question, once. */
export function takeHandoff(): string | null {
  const prompt = pending;
  pending = null;
  return prompt;
}

/** Calls back whenever a question arrives. Returns an unsubscribe. */
export function onHandoff(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
