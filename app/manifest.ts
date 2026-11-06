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
    // TODO: add 192px and 512px PNG icons and an apple-touch-icon before filming Home Screen mode.
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
