import { NextResponse, type NextRequest } from "next/server";
import { LEGACY_DEMO_USER_ID, SESSION_COOKIE, sessionUserId } from "@/lib/session-token";

// Seller pages and their APIs need a signed-in seller: someone who logged in with PayPal, or a demo account, which
// only the sign-in page can make, past the seller passcode. The buyer's pages (/pay, a store at /<handle>) stay open.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/stand/unlock") return NextResponse.next();
  const userId = await sessionUserId(request.cookies.get(SESSION_COOKIE)?.value);
  if (userId && userId !== LEGACY_DEMO_USER_ID) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const unlock = new URL("/stand/unlock", request.url);
  unlock.searchParams.set("next", pathname + search);
  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: ["/stand/:path*", "/api/stand/:path*"],
};
