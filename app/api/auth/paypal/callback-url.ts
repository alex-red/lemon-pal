import { env } from "@/lib/env";

/**
 * The address the seller's browser is using. request.url can carry the server's bind address (0.0.0.0 in
 * development), and cookies are per host, so redirecting there would drop the session.
 */
export function appOrigin(request: Request): string {
  const configured = env.publicAppUrl()?.replace(/\/$/, "");
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

/** Where PayPal sends the seller back. It must match the app's Return URL in the PayPal Developer Dashboard exactly. */
export function callbackUrl(request: Request): string {
  return `${appOrigin(request)}/api/auth/paypal/callback`;
}
