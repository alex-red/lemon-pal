import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { authorizeUrl } from "@/lib/paypal-login";
import { safeNextPath } from "@/lib/seller-auth";
import { cookieOptions, PAYPAL_STATE_COOKIE } from "@/lib/session-token";
import { appOrigin, callbackUrl } from "./callback-url";

// Starts Log in with PayPal: remembers a one-time state and where to go after, then sends the seller to PayPal.
export async function GET(request: Request) {
  if (!env.paypalLogin()) return NextResponse.redirect(new URL("/stand/unlock", appOrigin(request)), 303);
  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(authorizeUrl(state, callbackUrl(request)), 303);
  // The callback only accepts the state it finds here, so another site can't sign someone in to its own account.
  response.cookies.set(PAYPAL_STATE_COOKIE, `${state}|${next}`, cookieOptions(10 * 60));
  return response;
}
