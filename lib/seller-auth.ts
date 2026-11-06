// The seller passcode gate. Used by proxy.ts and the unlock route, so it sticks to Web Crypto and imports nothing
// server-only. The cookie holds an HMAC of a fixed label keyed by the passcode: it can't be made without the
// passcode, and changing the passcode signs every seller out.

export const SELLER_COOKIE = "lemonpal_seller";
export const SELLER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** The passcode, or null when none is set. */
export function sellerPasscode(): string | null {
  return process.env.SELLER_PASSCODE || null;
}

/**
 * Without a passcode the seller pages are open in development, so the app runs from a fresh clone.
 * In production they stay locked, because online orders hold buyers' names and addresses.
 */
export function sellerGateOpen(): boolean {
  return !sellerPasscode() && process.env.NODE_ENV !== "production";
}

async function hmac(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two strings in time that depends only on their length. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sellerToken(passcode: string): Promise<string> {
  return hmac(passcode, "lemonpal-seller-v1");
}

/** Whether a cookie value proves the seller entered the current passcode. */
export async function isSellerToken(value: string | undefined): Promise<boolean> {
  if (sellerGateOpen()) return true;
  const passcode = sellerPasscode();
  if (!passcode || !value) return false;
  return sameString(value, await sellerToken(passcode));
}

/** Whether a typed passcode is right. Both sides go through the HMAC, so the compare is fixed-length. */
export async function isSellerPasscode(typed: string): Promise<boolean> {
  const passcode = sellerPasscode();
  if (!passcode) return false;
  return sameString(await sellerToken(typed), await sellerToken(passcode));
}

/** Only same-site paths, so the unlock page can't be used to bounce someone to another site. */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/stand/register";
}
