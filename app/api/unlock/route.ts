import { cookies } from "next/headers";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { isSellerPasscode, SELLER_COOKIE, SELLER_COOKIE_MAX_AGE, sellerGateOpen, sellerPasscode, sellerToken } from "@/lib/seller-auth";
import { cookieOptions, DEMO_USER_ID, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken, STAND_COOKIE } from "@/lib/session-token";

// A few tries a minute per address, so the passcode can't be guessed by brute force.
const allow = createRateLimiter({ limit: 8, windowMs: 60_000 });

// Signs this browser in as the demo seller for 30 days when the passcode matches. In development without a
// passcode, the demo seller is open, so this just switches to them.
export async function POST(request: Request) {
  if (sellerGateOpen()) {
    (await cookies()).set(SESSION_COOKIE, await sessionToken(DEMO_USER_ID), cookieOptions(SESSION_MAX_AGE));
    (await cookies()).delete(STAND_COOKIE);
    return Response.json({ ok: true });
  }
  if (!allow(clientKey(request))) {
    return Response.json({ error: "Too many tries. Wait a minute and try again." }, { status: 429 });
  }
  const passcode = sellerPasscode();
  if (!passcode) {
    return Response.json({ error: "This Lemon Pal has no seller passcode yet. Set SELLER_PASSCODE on the server." }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as { passcode?: unknown } | null;
  const typed = typeof body?.passcode === "string" ? body.passcode : "";
  if (!(await isSellerPasscode(typed))) {
    return Response.json({ error: "That passcode isn’t right." }, { status: 401 });
  }
  (await cookies()).set(SELLER_COOKIE, await sellerToken(passcode), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SELLER_COOKIE_MAX_AGE,
  });
  // The passcode is the way in to the demo seller, so it signs this browser in as them, even after a PayPal login.
  (await cookies()).set(SESSION_COOKIE, await sessionToken(DEMO_USER_ID), cookieOptions(SESSION_MAX_AGE));
  (await cookies()).delete(STAND_COOKIE);
  return Response.json({ ok: true });
}
