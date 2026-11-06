import { cookies } from "next/headers";
import { SELLER_COOKIE } from "@/lib/seller-auth";
import { currentUser } from "@/lib/session";
import { SESSION_COOKIE, STAND_COOKIE } from "@/lib/session-token";
import { store } from "@/lib/store";

/**
 * Deletes the signed-in seller's Lemon Pal account, PayPal or demo: the user, every stand, and those stands' sales and
 * stores. Payments already captured stay in PayPal.
 */
export async function DELETE() {
  const user = await currentUser();
  await store.deleteUser(user.id);
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(STAND_COOKIE);
  jar.delete(SELLER_COOKIE);
  return Response.json({ id: user.id, next: "/stand/unlock?error=deleted" });
}
