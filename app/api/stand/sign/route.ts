import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { readSign, SIGN_IMAGE_TYPES, SignReadError, type SignImageType } from "@/lib/sign-reader";

const MAX_BYTES = 5 * 1024 * 1024; // the API's per-image limit
const allow = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });

// Reads a price-sign photo into a draft catalog for the seller to review.
export async function POST(request: Request) {
  if (!allow(clientKey(request))) {
    return Response.json({ error: "Too many sign photos this hour. Try again later." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!(photo instanceof File)) return Response.json({ error: "Attach a photo of the sign." }, { status: 400 });
  if (!SIGN_IMAGE_TYPES.includes(photo.type as SignImageType)) {
    return Response.json({ error: "Use a JPEG, PNG, WebP, or GIF photo." }, { status: 415 });
  }
  if (photo.size > MAX_BYTES) return Response.json({ error: "That photo is too large." }, { status: 413 });

  try {
    const data = Buffer.from(await photo.arrayBuffer()).toString("base64");
    const draft = await readSign({ data, mediaType: photo.type as SignImageType });
    return Response.json(draft);
  } catch (error) {
    if (error instanceof SignReadError) return Response.json({ error: error.message }, { status: 422 });
    console.error("Sign reading failed", error);
    return Response.json({ error: "Couldn't read the sign right now. Try again." }, { status: 502 });
  }
}
