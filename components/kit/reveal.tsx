"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "./cn";
import { ChevronDownIcon } from "./icons";

const STAGGER_MS = 50;
const MAX_STAGGER = 8;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Scrolls something into view, gliding unless the person has asked for Reduce Motion. */
export function scrollToReveal(element: Element, block: ScrollLogicalPosition = "start") {
  element.scrollIntoView({ behavior: prefersReducedMotion() ? "instant" : "smooth", block });
}

/**
 * Reveals a list's children in order as they scroll into view, for results that arrive all at once
 * and run past the screen. Rows already on screen settle in 50ms apart; the rest wait until the
 * person reaches them. Children added later (an "Add item" row) reveal too.
 *
 * Put the returned `ref` on the list. `waiting` counts the rows not seen yet, for a MoreBelow pill,
 * and `showNext` scrolls to the first of them. Without JavaScript nothing is hidden.
 */
export function useReveal<T extends HTMLElement>() {
  const [waiting, setWaiting] = useState(0);
  const pending = useRef(new Set<HTMLElement>());

  const ref = useCallback((list: T | null) => {
    if (!list) return;
    const waitingRows = pending.current;
    const sync = () => setWaiting(waitingRows.size);

    const observer = new IntersectionObserver(
      (entries) => {
        const shown = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        shown.forEach((entry, i) => {
          const row = entry.target as HTMLElement;
          row.style.setProperty("--reveal-delay", `${Math.min(i, MAX_STAGGER) * STAGGER_MS}ms`);
          row.dataset.revealed = "";
          observer.unobserve(row);
          waitingRows.delete(row);
        });
        sync();
      },
      // A row counts as reached once it's a little way above the bottom edge, so its motion is seen.
      { rootMargin: "0px 0px -8% 0px" },
    );

    const watch = (node: Node) => {
      if (!(node instanceof HTMLElement) || "revealed" in node.dataset) return;
      waitingRows.add(node);
      observer.observe(node);
    };
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach(watch);
        record.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement && waitingRows.delete(node)) observer.unobserve(node);
        });
      }
      sync();
    });

    list.dataset.revealList = "";
    Array.from(list.children).forEach(watch);
    mutations.observe(list, { childList: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
      waitingRows.clear();
      delete list.dataset.revealList;
    };
  }, []);

  const showNext = useCallback(() => {
    // The Set keeps insertion order, which is the list's order.
    const [next] = pending.current;
    if (next) scrollToReveal(next, "center");
  }, []);

  return { ref, waiting, showNext };
}

/**
 * A glass pill floating at the bottom of the screen that says how much of a result is still below,
 * like "6 more items". Tapping it scrolls to the next one. It waits a beat before appearing, so a
 * quick auto-scroll doesn't flash it, and it leaves once everything has been seen.
 */
export function MoreBelow({
  count,
  one,
  many,
  onClick,
  className,
}: {
  count: number;
  one: string;
  many: string;
  onClick: () => void;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-4",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="glass pressable focus-ring pointer-events-auto inline-flex h-11 animate-rise items-center gap-1.5 rounded-full px-5 text-callout font-semibold text-ink [animation-delay:700ms]"
      >
        <span className="font-price">{count}</span> more {count === 1 ? one : many}
        <ChevronDownIcon aria-hidden className="text-[1.1rem] text-ink-2" />
      </button>
    </div>
  );
}
