import { cookies } from "next/headers";
import { z } from "zod";
import { createDemoAccount } from "@/lib/demo";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import {
  isSellerPasscode,
  isSellerToken,
  SELLER_COOKIE,
  SELLER_COOKIE_MAX_AGE,
  sellerGateOpen,
  sellerPasscode,
  sellerToken,
} from "@/lib/seller-auth";
import { cookieOptions, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken, STAND_COOKIE } from "@/lib/session-token";

// A few passcode tries a minute per address, so the passcode can't be guessed by brute force.
const allowTry = createRateLimiter({ limit: 8, windowMs: 60_000 });
// Each demo account holds a month of sales, so one address can't make them by the hundred.
const allowCreate = createRateLimiter({ limit: 10, windowMs: 60 * 60_000 });

const Body = z.object({
  passcode: z.string().max(200).optional(),
  // The browser's Date#getTimezoneOffset, so the demo's market hours land in the seller's own morning.
  tzOffsetMinutes: z.number().int().min(-14 * 60).max(14 * 60).optional(),
});

/**
 * Creates a demo account of the browser's own, loaded with the sticker shop, and signs in to it. Needs the seller
 * passcode, typed here or remembered from an earlier unlock (in development without a passcode, it's open).
 * Returns the account's sign-in token, which the page keeps in localStorage so the browser can come back to it.
 */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  const { passcode: typed, tzOffsetMinutes } = body.success ? body.data : {};
  const jar = await cookies();

  if (!sellerGateOpen() && !(await isSellerToken(jar.get(SELLER_COOKIE)?.value))) {
    const passcode = sellerPasscode();
    if (!passcode) {
      return Response.json({ error: "This Lemon Pal has no seller passcode yet. Set SELLER_PASSCODE on the server." }, { status: 503 });
    }
    if (!allowTry(clientKey(request))) {
      return Response.json({ error: "Too many tries. Wait a minute and try again." }, { status: 429 });
    }
    if (!(await isSellerPasscode(typed ?? ""))) {
      return Response.json({ error: "That passcode isn’t right." }, { status: 401 });
    }
    // Remembered, so making another demo account later doesn't ask again.
    jar.set(SELLER_COOKIE, await sellerToken(passcode), cookieOptions(SELLER_COOKIE_MAX_AGE));
  }

  if (!allowCreate(clientKey(request))) {
    return Response.json({ error: "That’s a lot of demo accounts. Wait an hour, or keep using one you have." }, { status: 429 });
  }
  const user = await createDemoAccount({ tzOffsetMinutes });
  const token = await sessionToken(user.id);
  jar.set(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE));
  jar.delete(STAND_COOKIE);
  return Response.json({ account: { id: user.id, name: user.name, token, createdAt: user.createdAt } }, { status: 201 });
}
