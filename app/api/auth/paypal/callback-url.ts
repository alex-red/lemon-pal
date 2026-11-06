import { env } from "@/lib/env";

/** Where PayPal sends the seller back. It must match the app's Return URL in the PayPal Developer Dashboard exactly. */
export function callbackUrl(request: Request): string {
  const origin = env.publicAppUrl()?.replace(/\/$/, "") ?? new URL(request.url).origin;
  return `${origin}/api/auth/paypal/callback`;
}
