import "server-only";
import { env } from "./env";
import { PayPalError } from "./paypal";

// Log in with PayPal: OpenID Connect's authorization code flow, over plain fetch.
// https://developer.paypal.com/docs/log-in-with-paypal/integrate/

/** Name and email to greet the seller, and the payer id to know them by. */
const SCOPES = ["openid", "profile", "email", "https://uri.paypal.com/services/paypalattributes"];

/** Where to send the seller to sign in. `redirectUri` must match the Return URL set for the app in the dashboard. */
export function authorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    flowEntry: "static",
    client_id: env.paypalClientId(),
    response_type: "code",
    scope: SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
    // The whole tab, not a popup, so it works the same on a phone, a tablet and a desktop.
    fullPage: "true",
  });
  return `${env.paypalWebBase()}/connect?${params}`;
}

/** Trades the code PayPal sent back for an access token. The code works once. */
export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const basic = Buffer.from(`${env.paypalClientId()}:${env.paypalClientSecret()}`).toString("base64");
  const res = await fetch(`${env.paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string } | null;
  if (!res.ok || !json?.access_token) throw new PayPalError(res.status, res.headers.get("paypal-debug-id"), json);
  return json.access_token;
}

/** The PayPal account behind a sign-in. `paypalId` never changes for an account, so it's what we know the seller by. */
export type PayPalIdentity = { paypalId: string; name: string; email?: string };

type UserInfo = {
  user_id?: string;
  sub?: string;
  payer_id?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  emails?: { value?: string; primary?: boolean }[];
};

/**
 * Reads who signed in. PayPal documents two userinfo paths and two response shapes, so this tries the newer path and
 * falls back, and reads the payer id, email and name from whichever fields came back. The newer path can answer 400
 * "Unable to fetch details" for an account it can't describe in its schema, where the OpenID path still works, so any
 * failure but an expired token moves on to the next path.
 */
export async function userInfo(accessToken: string): Promise<PayPalIdentity> {
  const paths = ["/v1/identity/oauth2/userinfo?schema=paypalv1.1", "/v1/identity/openidconnect/userinfo?schema=openid"];
  let info: UserInfo | null = null;
  let failure: PayPalError | null = null;
  for (const path of paths) {
    const res = await fetch(`${env.paypalApiBase()}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      info = (await res.json()) as UserInfo;
      break;
    }
    failure = new PayPalError(res.status, res.headers.get("paypal-debug-id"), {
      path: path.split("?")[0],
      response: await res.json().catch(() => null),
    });
    if (res.status === 401) break; // the token itself was refused, so the other path would refuse it too
  }
  if (!info && failure) throw failure;
  // Prefer the payer id: it's the account's id in every PayPal API. user_id and sub are the OpenID subject.
  const paypalId = info?.payer_id || info?.user_id || info?.sub;
  if (!info || !paypalId) throw new Error("PayPal didn't say who signed in");
  const email = info.email || info.emails?.find((e) => e.primary)?.value || info.emails?.[0]?.value;
  const name = info.name?.trim() || [info.given_name, info.family_name].filter(Boolean).join(" ").trim() || email || "PayPal seller";
  return { paypalId, name, ...(email ? { email } : {}) };
}
