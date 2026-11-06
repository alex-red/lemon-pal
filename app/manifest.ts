import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LemonPal",
    short_name: "LemonPal",
    description: "Turn a price sign into a register and take PayPal payments at a pop-up stand.",
    start_url: "/stand/register",
    display: "standalone",
    orientation: "any",
    background_color: "#fffbea",
    // Matches the page's light theme-color, so an installed app's title bar runs into the page.
    theme_color: "#fffbea",
    icons: [
      { src: "/icons/lemonpal-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/lemonpal-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/lemonpal-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/lemonpal-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
