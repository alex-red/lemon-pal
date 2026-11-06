import "server-only";
import { networkInterfaces } from "node:os";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** This machine's first private IPv4 address on the local network, or null if it has none. */
export function lanAddress(): string | null {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a!.address);
  // Prefer home and office ranges over VPN or container bridges.
  return (
    addresses.find((a) => a.startsWith("192.168.")) ??
    addresses.find((a) => a.startsWith("10.")) ??
    addresses.find((a) => /^172\.(1[6-9]|2\d|3[01])\./.test(a)) ??
    null
  );
}

/**
 * The origin to put in sale QR codes. PUBLIC_APP_URL wins when set. In development, a seller on
 * localhost gets the machine's network address instead, so a phone on the same Wi-Fi can open the code.
 * Returns null to use the page's own origin.
 */
export function payOrigin(host: string | null, publicAppUrl: string | null): string | null {
  if (publicAppUrl) return publicAppUrl.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" || !host) return null;
  const { hostname, port } = new URL(`http://${host}`);
  if (!LOOPBACK.has(hostname)) return null;
  const lan = lanAddress();
  return lan ? `http://${lan}${port ? `:${port}` : ""}` : null;
}
