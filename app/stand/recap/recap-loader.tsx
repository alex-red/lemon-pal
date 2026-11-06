"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/kit";

// AG Studio is large, so only the recap route loads it, and only in the browser.
export const RecapLoader = dynamic(() => import("./recap-studio").then((m) => m.RecapStudio), {
  ssr: false,
  loading: () => (
    <p className="flex h-full min-h-60 items-center justify-center gap-2 text-subhead text-ink-2">
      <Spinner className="text-[1.1rem]" /> Loading recap…
    </p>
  ),
});
