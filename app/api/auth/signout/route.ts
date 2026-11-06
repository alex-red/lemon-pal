import { cookies } from "next/headers";
import { SELLER_COOKIE } from "@/lib/seller-auth";
import { SESSION_COOKIE, STAND_COOKIE } from "@/lib/session-token";

// Signs the seller out of Lemon Pal, including the demo passcode, so the next visit starts at the sign-in page.
// Their PayPal session is PayPal's: this never touches it.
export async function POST() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(STAND_COOKIE);
  jar.delete(SELLER_COOKIE);
  return Response.json({ next: "/stand/unlock" });
}
