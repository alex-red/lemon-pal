import { cookies } from "next/headers";
import { SELLER_COOKIE } from "@/lib/seller-auth";
import { currentUser } from "@/lib/session";
import { DEMO_USER_ID, SESSION_COOKIE, STAND_COOKIE } from "@/lib/session-token";
import { store } from "@/lib/store";

/**
 * Deletes the signed-in seller's Lemon Pal account: the user, every stand, and those stands' sales and stores.
 * Payments already captured stay in PayPal. The shared demo seller can't be deleted.
 */
export async function DELETE() {
  const user = await currentUser();
  if (user.id === DEMO_USER_ID) {
    return Response.json({ error: "The demo seller is shared, so it can’t be deleted." }, { status: 403 });
  }
  await store.deleteUser(user.id);
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(STAND_COOKIE);
  jar.delete(SELLER_COOKIE);
  return Response.json({ next: "/stand/unlock?error=deleted" });
}
