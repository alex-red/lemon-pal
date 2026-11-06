import { cookies } from "next/headers";
import { z } from "zod";
import { cookieOptions, SESSION_COOKIE, SESSION_MAX_AGE, sessionUserId, STAND_COOKIE } from "@/lib/session-token";
import { store } from "@/lib/store";

const Body = z.object({ token: z.string().min(1).max(200) });

/**
 * Signs back in to a demo account this browser made, from the token the sign-in page kept in localStorage. The token
 * is signed by the server, so it proves the account. Only demo accounts come back this way: a PayPal seller logs in
 * with PayPal.
 */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  const userId = body.success ? await sessionUserId(body.data.token) : null;
  const user = userId ? await store.getUser(userId) : null;
  if (!body.success || !user?.demo) {
    return Response.json(
      { error: "That demo account is gone. Demo accounts are cleared after a month unused.", gone: true },
      { status: 404 },
    );
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, body.data.token, cookieOptions(SESSION_MAX_AGE));
  jar.delete(STAND_COOKIE);
  return Response.json({ id: user.id, name: user.name });
}
