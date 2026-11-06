/**
 * Keeps the first emoji in `text`, or returns undefined if it doesn't start with one.
 * Safe in client and server code. Used for item icons from the sign reader and the seller.
 */
export function cleanEmoji(text: string | null | undefined): string | undefined {
  const first = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment((text ?? "").trim())][0]?.segment;
  return first && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(first) ? first : undefined;
}
