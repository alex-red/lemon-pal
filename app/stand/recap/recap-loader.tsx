"use client";

import dynamic from "next/dynamic";

// AG Studio is large, so only the recap route loads it, and only in the browser.
export const RecapLoader = dynamic(() => import("./recap-studio").then((m) => m.RecapStudio), {
  ssr: false,
  loading: () => <p className="opacity-60">Loading recap…</p>,
});
