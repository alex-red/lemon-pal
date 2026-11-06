import "server-only";
import { headers } from "next/headers";
import { env } from "./env";
import { payOrigin } from "./lan";

/**
 * The address a seller page shows for its public link (`origin`), and the one to put in its QR code (`qrOrigin`),
 * which in development is the network address so a phone on the same Wi-Fi can open it.
 */
export async function requestOrigins(): Promise<{ origin: string; qrOrigin: string }> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const publicAppUrl = env.publicAppUrl();
  const origin = publicAppUrl?.replace(/\/$/, "") ?? (host ? `${proto}://${host}` : "");
  return { origin, qrOrigin: payOrigin(host, publicAppUrl) ?? origin };
}
