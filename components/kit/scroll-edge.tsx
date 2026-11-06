"use client";

import { useEffect, useState } from "react";

/**
 * iOS 26's scroll edge effect: content softly blurs and fades as it slides under the top of the screen,
 * or under floating chrome at the bottom. The top edge appears only once the page has scrolled.
 * Put one per edge, anywhere on the page. It's decoration, hidden from assistive tech.
 */
export function ScrollEdge({ edge = "top" }: { edge?: "top" | "bottom" }) {
  return <div aria-hidden data-edge={edge} className="scroll-edge" />;
}

/**
 * True while the person scrolls down through a long page, so floating chrome can minimize like an iOS 26
 * tab bar. It springs back on any scroll up, near the top or bottom, and after a moment's pause, so the
 * controls it shrinks are never small for long.
 */
export function useScrollCompact() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;

    function update() {
      frame = 0;
      const y = window.scrollY;
      const nearEdge = y < 80 || y + window.innerHeight > document.documentElement.scrollHeight - 80;
      if (Math.abs(y - lastY) > 4) setCompact(y > lastY && !nearEdge);
      lastY = y;
      clearTimeout(idle);
      idle = setTimeout(() => setCompact(false), 1200);
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(idle);
    };
  }, []);

  return compact;
}
