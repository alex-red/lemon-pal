import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureDemoUser } from "./demo";
import { DEMO_USER_ID, SESSION_COOKIE, SESSION_MAX_AGE, sessionUserId, STAND_COOKIE } from "./session-token";
import { kindOf } from "./stands";
import { store } from "./store";
import type { Sale, Stand, StandKind, User } from "./types";

/**
 * The signed-in seller. A seller who logged in with PayPal is themselves. Anyone else got past proxy.ts with the
 * passcode, so they're the demo user, even on the first request before that cookie is set.
 */
export async function currentUser(): Promise<User> {
  const userId = await sessionUserId((await cookies()).get(SESSION_COOKIE)?.value);
  if (userId && userId !== DEMO_USER_ID) {
    const user = await store.getUser(userId);
    // A session for a seller who no longer exists never falls back to the demo seller: that would skip the passcode.
    if (!user) redirect("/stand/unlock?error=signed-out");
    return user;
  }
  return ensureDemoUser();
}

/** The seller's stands, oldest first. Every user has at least one. */
export async function userStands(user: User): Promise<Stand[]> {
  return store.listStands(user.id);
}

/**
 * The stand a seller page shows. It's the stand last switched to, unless the page needs another kind: the register
 * needs a local stand and the store editor an online one, so they open the seller's first stand of that kind.
 * Returns null when the seller has no stand of that kind yet.
 */
export async function currentStand(kind?: StandKind): Promise<{ stand: Stand; stands: Stand[]; user: User; remembered: boolean } | null> {
  const user = await currentUser();
  const stands = await userStands(user);
  const chosen = (await cookies()).get(STAND_COOKIE)?.value;
  const fits = (s: Stand) => !kind || kindOf(s) === kind;
  const stand = stands.find((s) => s.id === chosen && fits(s)) ?? stands.find(fits) ?? null;
  // remembered is false when the page had to pick another stand than the last one switched to.
  return stand ? { stand, stands, user, remembered: stand.id === chosen } : null;
}

/**
 * The stand a seller API request acts on: the `stand` query parameter the page sent, or the current stand.
 * null for a stand the seller doesn't own, so one seller can never touch another's stand. Answer that with standNotFound().
 */
export async function requestStand(request: Request): Promise<Stand | null> {
  const id = new URL(request.url).searchParams.get("stand");
  if (!id) return (await currentStand())?.stand ?? null;
  const [user, stand] = await Promise.all([currentUser(), store.getStand(id)]);
  return stand && stand.ownerId === user.id ? stand : null;
}

/** A sale on one of the seller's stands, or null. Seller routes that take a sale id check it with this. */
export async function ownedSale(saleId: string): Promise<{ sale: Sale; stand: Stand } | null> {
  const [user, sale] = await Promise.all([currentUser(), store.getSale(saleId)]);
  if (!sale) return null;
  const stand = await store.getStand(sale.standId);
  return stand && stand.ownerId === user.id ? { sale, stand } : null;
}

export const standNotFound = () => Response.json({ error: "That stand isn’t yours or doesn’t exist." }, { status: 404 });

/** Remembers the stand the seller is working on. Only route handlers can set cookies. */
export async function rememberStand(standId: string) {
  (await cookies()).set(STAND_COOKIE, standId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}
