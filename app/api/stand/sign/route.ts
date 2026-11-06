import { requestStand } from "@/lib/session";
import { startDraft } from "@/lib/first-sale";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { MAX_LIST_CHARS, readSign, SIGN_IMAGE_TYPES, SignReadError, type SignImageType } from "@/lib/sign-reader";
import { store } from "@/lib/store";

const MAX_BYTES = 5 * 1024 * 1024; // the API's per-image limit
const allow = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });

// Reads a price-sign photo, or a pasted price list, into a draft catalog for the seller to review.
export async function POST(request: Request) {
  const arrivedAt = new Date();
  if (!allow(clientKey(request))) {
    return Response.json({ error: "Too many price lists read this hour. Try again later." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const photo = form?.get("photo");
  const text = form?.get("text");

  let input: Parameters<typeof readSign>[0];
  if (typeof text === "string") {
    const list = text.trim();
    if (!list) return Response.json({ error: "Paste or type your items and prices first." }, { status: 400 });
    if (list.length > MAX_LIST_CHARS) {
      return Response.json({ error: `That list is too long. Keep it under ${MAX_LIST_CHARS} characters.` }, { status: 413 });
    }
    input = { text: list };
  } else if (photo instanceof File) {
    if (!SIGN_IMAGE_TYPES.includes(photo.type as SignImageType)) {
      return Response.json({ error: "Use a JPEG, PNG, WebP, or GIF photo." }, { status: 415 });
    }
    if (photo.size > MAX_BYTES) return Response.json({ error: "That photo is too large." }, { status: 413 });
    input = { image: { data: Buffer.from(await photo.arrayBuffer()).toString("base64"), mediaType: photo.type as SignImageType } };
  } else {
    return Response.json({ error: "Attach a photo of the sign, or paste your price list." }, { status: 400 });
  }

  try {
    const draft = await readSign(input);
    // The time to first sale counts from here: the seller has a sign and is setting up.
    const stand = await requestStand(request);
    const started = stand && startDraft(stand, arrivedAt);
    if (stand && started !== stand) await store.saveStand(started!);
    return Response.json(draft);
  } catch (error) {
    if (error instanceof SignReadError) return Response.json({ error: error.message }, { status: 422 });
    console.error("Sign reading failed", error);
    return Response.json({ error: "Couldn't read that right now. Try again." }, { status: 502 });
  }
}
