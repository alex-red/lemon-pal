import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone on the same Wi-Fi load the dev server by its network address, to scan and pay a sale QR code.
  // Private IPv4 ranges and Bonjour (.local) names only. 127.0.0.1 is for Log in with PayPal, which won't return
  // to localhost: without it the dev server refuses the HMR socket there and pages never hydrate.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
};

export default nextConfig;
