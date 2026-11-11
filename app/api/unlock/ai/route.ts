import { cookies } from "next/headers";
import { z } from "zod";
import { PASSCODE_NAME } from "@/lib/ai-preview";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { isSellerPasscode, SELLER_COOKIE, SELLER_COOKIE_MAX_AGE, sellerGateOpen, sellerPasscode, sellerToken } from "@/lib/seller-auth";
import { cookieOptions } from "@/lib/session-token";

// A few passcode tries a minute per address, so the passcode can't be guessed by brute force. Addresses can be
// faked, so there's a cap across everyone too.
const allowTry = createRateLimiter({ limit: 8, windowMs: 60_000 });
const allowAnyTry = createRateLimiter({ limit: 60, windowMs: 60_000 });

const Body = z.object({ passcode: z.string().max(200) });

/**
 * Unlocks real AI for this browser: Claude reading any sign, Pal answering anything, and Booth Analyst. Needs the
 * seller passcode, and remembers it in a cookie for 30 days. Works signed in or out, so a judge can unlock before or
 * after making a demo account.
 */
export async function POST(request: Request) {
  if (sellerGateOpen()) return Response.json({ ok: true });
  const passcode = sellerPasscode();
  if (!passcode) {
    return Response.json({ error: `Real AI is off here: the server has no ${PASSCODE_NAME}.` }, { status: 503 });
  }
  if (!allowTry(clientKey(request)) || !allowAnyTry("all")) {
    return Response.json({ error: "Too many tries. Wait a minute and try again." }, { status: 429 });
  }
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || !(await isSellerPasscode(body.data.passcode))) {
    return Response.json({ error: "That passcode isn’t right." }, { status: 401 });
  }
  (await cookies()).set(SELLER_COOKIE, await sellerToken(passcode), cookieOptions(SELLER_COOKIE_MAX_AGE));
  return Response.json({ ok: true });
}
