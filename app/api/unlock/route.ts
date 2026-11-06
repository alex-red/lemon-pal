import { cookies } from "next/headers";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { isSellerPasscode, SELLER_COOKIE, SELLER_COOKIE_MAX_AGE, sellerPasscode, sellerToken } from "@/lib/seller-auth";

// A few tries a minute per address, so the passcode can't be guessed by brute force.
const allow = createRateLimiter({ limit: 8, windowMs: 60_000 });

// Signs the seller in for 30 days when the passcode matches.
export async function POST(request: Request) {
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
  return Response.json({ ok: true });
}
