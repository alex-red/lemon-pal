import { NextResponse, type NextRequest } from "next/server";
import { isSellerToken, SELLER_COOKIE } from "@/lib/seller-auth";

// Seller pages and their APIs need the seller passcode. The buyer's pages (/pay, a store at /<handle>) stay open.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/stand/unlock") return NextResponse.next();
  if (await isSellerToken(request.cookies.get(SELLER_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Enter the seller passcode first." }, { status: 401 });
  }
  const unlock = new URL("/stand/unlock", request.url);
  unlock.searchParams.set("next", pathname + search);
  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: ["/stand/:path*", "/api/stand/:path*"],
};
