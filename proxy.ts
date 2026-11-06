import { NextResponse, type NextRequest } from "next/server";
import { isSellerToken, SELLER_COOKIE } from "@/lib/seller-auth";
import { cookieOptions, DEMO_USER_ID, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken, sessionUserId } from "@/lib/session-token";

// Seller pages and their APIs need a signed-in seller. The buyer's pages (/pay, a store at /<handle>) stay open.
// A seller who logged in with PayPal is in. The demo seller is behind the passcode: past it, a browser with no
// session becomes the demo seller, so judges get straight to a stand.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/stand/unlock") return NextResponse.next();
  const userId = await sessionUserId(request.cookies.get(SESSION_COOKIE)?.value);
  if (userId && userId !== DEMO_USER_ID) return NextResponse.next();
  if (await isSellerToken(request.cookies.get(SELLER_COOKIE)?.value)) return asDemo(request, userId);

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Enter the seller passcode first." }, { status: 401 });
  }
  const unlock = new URL("/stand/unlock", request.url);
  unlock.searchParams.set("next", pathname + search);
  return NextResponse.redirect(unlock);
}

async function asDemo(request: NextRequest, userId: string | null) {
  const response = NextResponse.next();
  if (!userId) response.cookies.set(SESSION_COOKIE, await sessionToken(DEMO_USER_ID), cookieOptions(SESSION_MAX_AGE));
  return response;
}

export const config = {
  matcher: ["/stand/:path*", "/api/stand/:path*"],
};
