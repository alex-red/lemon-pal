import { NextResponse, type NextRequest } from "next/server";
import { isSellerToken, SELLER_COOKIE } from "@/lib/seller-auth";
import { DEMO_USER_ID, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken, sessionUserId } from "@/lib/session-token";

// Seller pages and their APIs need the seller passcode. The buyer's pages (/pay, a store at /<handle>) stay open.
// Past the passcode, a seller with no account session is signed in as the demo user until there's real sign-in.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/stand/unlock") return NextResponse.next();
  if (await isSellerToken(request.cookies.get(SELLER_COOKIE)?.value)) return signedIn(request);

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Enter the seller passcode first." }, { status: 401 });
  }
  const unlock = new URL("/stand/unlock", request.url);
  unlock.searchParams.set("next", pathname + search);
  return NextResponse.redirect(unlock);
}

async function signedIn(request: NextRequest) {
  const response = NextResponse.next();
  if (!(await sessionUserId(request.cookies.get(SESSION_COOKIE)?.value))) {
    response.cookies.set(SESSION_COOKIE, await sessionToken(DEMO_USER_ID), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }
  return response;
}

export const config = {
  matcher: ["/stand/:path*", "/api/stand/:path*"],
};
