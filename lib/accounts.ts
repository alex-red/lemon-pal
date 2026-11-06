import "server-only";
import { createHash } from "node:crypto";
import { env } from "./env";
import type { PayPalIdentity } from "./paypal-login";
import { store } from "./store";
import type { Stand, User } from "./types";

/**
 * Our id for a PayPal account. Derived from its PayPal id, so signing in again finds the same seller, and hashed, so
 * the cookie never carries the PayPal id and the id has no dots (the session cookie splits on the last one).
 */
function userIdFor(paypalId: string): string {
  return `pp-${createHash("sha256").update(paypalId).digest("hex").slice(0, 24)}`;
}

/**
 * Finds or creates the seller for a PayPal sign-in. A new seller starts with one empty stand at events, named after
 * them, and goes straight to setup to snap its sign. Returns whether they're new.
 */
export async function signInWithPayPal(identity: PayPalIdentity): Promise<{ user: User; isNew: boolean }> {
  const id = userIdFor(identity.paypalId);
  const existing = await store.getUser(id);
  if (existing) {
    // Keep the name and email current with their PayPal account.
    const user: User = { ...existing, name: identity.name, ...(identity.email ? { email: identity.email } : {}) };
    await store.saveUser(user);
    return { user, isNew: false };
  }

  const user: User = {
    id,
    name: identity.name,
    createdAt: new Date().toISOString(),
    paypalId: identity.paypalId,
    ...(identity.email ? { email: identity.email } : {}),
  };
  const first = identity.name.split(/\s+/)[0];
  const stand: Stand = {
    id: crypto.randomUUID(),
    ownerId: user.id,
    kind: "local",
    name: first && first !== identity.email ? `${first}’s Stand` : "My Stand",
    currency: env.currency(),
    items: [],
    publishedAt: null,
  };
  await store.saveStand(stand);
  await store.saveUser(user);
  return { user, isNew: true };
}
