import { NextResponse, type NextRequest } from "next/server";
import { signInWithPayPal } from "@/lib/accounts";
import { PayPalError } from "@/lib/paypal";
import { exchangeCode, userInfo } from "@/lib/paypal-login";
import { safeNextPath } from "@/lib/seller-auth";
import { userStands } from "@/lib/session";
import {
  cookieOptions,
  PAYPAL_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  sessionToken,
  STAND_COOKIE,
} from "@/lib/session-token";
import { appOrigin, callbackUrl } from "../callback-url";

// PayPal sends the seller back here with a one-time code. Checks the state, trades the code for who they are,
// then signs them in as their own seller, with their own stands.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const [expected, savedNext] = (request.cookies.get(PAYPAL_STATE_COOKIE)?.value ?? "").split("|");
  const go = (path: string) => {
    const response = NextResponse.redirect(new URL(path, appOrigin(request)), 303);
    response.cookies.delete(PAYPAL_STATE_COOKIE);
    return response;
  };

  // The seller closed PayPal or said no.
  if (url.searchParams.get("error")) return go("/stand/unlock?error=paypal-canceled");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !expected || state !== expected) return go("/stand/unlock?error=paypal-state");

  try {
    const identity = await userInfo(await exchangeCode(code, callbackUrl(request)));
    const { user, isNew } = await signInWithPayPal(identity);
    // A new seller has an empty stand, so they start by snapping its sign.
    const response = go(isNew ? "/stand/setup" : safeNextPath(savedNext));
    response.cookies.set(SESSION_COOKIE, await sessionToken(user.id), cookieOptions(SESSION_MAX_AGE));
    // Open their own first stand, not whichever stand this browser had open before.
    const [first] = await userStands(user);
    if (first) response.cookies.set(STAND_COOKIE, first.id, cookieOptions(SESSION_MAX_AGE));
    return response;
  } catch (error) {
    console.error("Log in with PayPal failed", error instanceof PayPalError ? `${error.message} ${JSON.stringify(error.body)}` : error);
    return go("/stand/unlock?error=paypal");
  }
}
