import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { env } from "./env";
import type { DraftItem } from "./types";

export const SIGN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type SignImageType = (typeof SIGN_IMAGE_TYPES)[number];

const SignSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("Item name as written on the sign, in its natural casing"),
      price_cents: z
        .number()
        .int()
        .nullable()
        .describe("Price in cents, e.g. 250 for $2.50. null if the price is missing, unreadable, or ambiguous."),
      confidence: z.enum(["high", "low"]).describe("low if any part of the name or price was hard to read"),
    }),
  ),
});

const PROMPT = `This is a photo of a handwritten or printed price sign at a pop-up stand, market stall, or lemonade stand.
List every item for sale with its price, in the order they appear on the sign.

- Use the price exactly as written. Don't guess or calculate a price that isn't shown.
- If a price is smudged, cut off, or could be read more than one way, set price_cents to null so the seller enters it.
- Mark confidence low when any part of the name or price was hard to read.
- Leave out anything that isn't an item for sale, such as the stand name, slogans, or payment notes.
- If there's no price list in the photo, return an empty items array.`;

export class SignReadError extends Error {}

let client: Anthropic | null = null;

export async function readSign(image: { data: string; mediaType: SignImageType }): Promise<DraftItem[]> {
  client ??= new Anthropic({ apiKey: env.anthropicApiKey() });

  const response = await client.beta.messages.parse({
    model: "claude-sonnet-5-5",
    max_tokens: 16000,
    // On a safety decline, the API retries on a fallback model within the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(SignSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new SignReadError("The sign couldn't be read. Try another photo.");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new SignReadError("The sign reader returned an incomplete answer. Try again.");
  }

  return response.parsed_output.items
    .map((item) => ({
      name: item.name.trim().slice(0, 60),
      // Drop impossible prices so the seller has to enter them.
      priceCents:
        item.price_cents !== null && item.price_cents > 0 && item.price_cents <= 100_000 ? item.price_cents : null,
      confidence: item.confidence,
    }))
    .filter((item) => item.name.length > 0);
}
