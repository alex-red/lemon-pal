import { cookies } from "next/headers";
import { z } from "zod";
import { createDemoAccount } from "@/lib/demo";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { cookieOptions, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken, STAND_COOKIE } from "@/lib/session-token";

// Each demo account holds a month of sales, so one address can't make them by the hundred. Addresses can be faked,
// so there's a cap across everyone too.
const allowCreate = createRateLimiter({ limit: 10, windowMs: 60 * 60_000 });
const allowAnyCreate = createRateLimiter({ limit: 200, windowMs: 60 * 60_000 });

const Body = z.object({
  // The browser's Date#getTimezoneOffset, so the demo's market hours land in the seller's own morning.
  tzOffsetMinutes: z.number().int().min(-14 * 60).max(14 * 60).optional(),
});

/**
 * Creates a demo account of the browser's own, loaded with the sticker shop, and signs in to it. Anyone can make one:
 * it runs on simulated AI until the browser enters the seller passcode (POST /api/unlock/ai), so it never calls
 * Claude on its own. Returns the account's sign-in token, which the page keeps in localStorage so the browser can
 * come back to it.
 */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  const { tzOffsetMinutes } = body.success ? body.data : {};
  const jar = await cookies();

  if (!allowCreate(clientKey(request)) || !allowAnyCreate("all")) {
    return Response.json({ error: "That’s a lot of demo accounts. Wait an hour, or keep using one you have." }, { status: 429 });
  }
  const user = await createDemoAccount({ tzOffsetMinutes });
  const token = await sessionToken(user.id);
  jar.set(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE));
  jar.delete(STAND_COOKIE);
  return Response.json({ account: { id: user.id, name: user.name, token, createdAt: user.createdAt } }, { status: 201 });
}
