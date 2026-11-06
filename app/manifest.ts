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
    theme_color: "#ffe14d",
    icons: [
      { src: "/icons/lemonpal-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/lemonpal-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
