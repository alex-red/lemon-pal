// The signed-in seller, as a cookie. Used by proxy.ts, so like seller-auth it sticks to Web Crypto and imports
// nothing server-only. For now everyone past the passcode is signed in as the demo user; real sign-in only has to
// set this same cookie.
import { hmac, sameString } from "./seller-auth";

export const SESSION_COOKIE = "lemonpal_session";
/** Which of the seller's stands the stand pages open by default. Not a secret: the server checks ownership. */
export const STAND_COOKIE = "lemonpal_stand";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const DEMO_USER_ID = "demo";

function sessionSecret(): string {
  // The passcode is a fine key until there's real sign-in: changing it signs everyone out, as it should.
  return process.env.SESSION_SECRET || process.env.SELLER_PASSCODE || "lemonpal-dev-session";
}

export async function sessionToken(userId: string): Promise<string> {
  return `${userId}.${await hmac(sessionSecret(), `lemonpal-session-v1:${userId}`)}`;
}

/** The user id a cookie value proves, or null when it's missing or forged. */
export async function sessionUserId(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const userId = value.slice(0, dot);
  return sameString(value, await sessionToken(userId)) ? userId : null;
}
