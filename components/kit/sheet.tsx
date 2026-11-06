"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "./cn";
import { XmarkIcon } from "./icons";

// The control the person last pressed, so a sheet can open out of it. Safari doesn't focus buttons on click,
// so document.activeElement alone would miss most taps.
let lastPressed: Element | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (event) => {
      lastPressed = (event.target as Element | null)?.closest("button, a, [role='button']") ?? null;
    },
    { capture: true, passive: true },
  );
}

/** How far a dragged sheet has to travel, or how fast, before letting go dismisses it. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.6; // px per ms

/**
 * A modal sheet built on <dialog>, so focus trapping, Escape and an inert background come from the browser.
 * On iPad and desktop it's a centered form sheet that grows out of the button that opened it and shrinks
 * back into it, like iOS 26. On phones it rises from the bottom edge, and dragging its top edge down dismisses it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ startY: number; lastY: number; lastTime: number; velocity: number } | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.style.removeProperty("transform"); // left over from a drag-to-dismiss
      aimAt(dialog, lastPressed ?? document.activeElement);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!window.matchMedia("(max-width: 39.99rem)").matches || event.button !== 0) return;
    if ((event.target as Element).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0 };
    ref.current?.style.setProperty("transition", "none");
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    const dialog = ref.current;
    if (!state || !dialog) return;
    const dt = Math.max(1, event.timeStamp - state.lastTime);
    state.velocity = (event.clientY - state.lastY) / dt;
    state.lastY = event.clientY;
    state.lastTime = event.timeStamp;
    const dy = event.clientY - state.startY;
    // Pulling up resists, like a rubber band. Pulling down follows the finger.
    dialog.style.transform = `translateY(${dy > 0 ? dy : -Math.sqrt(-dy) * 2}px)`;
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    const dialog = ref.current;
    drag.current = null;
    if (!state || !dialog) return;
    dialog.style.removeProperty("transition");
    const dy = event.clientY - state.startY;
    if (dy > DISMISS_DISTANCE || state.velocity > DISMISS_VELOCITY) {
      dialog.style.transform = "translateY(100%)";
      onClose();
    } else {
      dialog.style.removeProperty("transform"); // springs back with the sheet's own transition
    }
  }

  return (
    <dialog
      ref={ref}
      data-sheet
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        // A tap on the backdrop (the dialog element itself, outside the panel) dismisses.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "glass-thick m-auto w-[min(34rem,calc(100vw-2rem))] overflow-visible rounded-sheet p-0 text-ink",
        "max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <div
        className="touch-none select-none max-sm:cursor-grab"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* The grabber says "drag me" on phones. The close button stays for anyone who can't drag. */}
        <span aria-hidden className="mx-auto mt-2 block h-[5px] w-9 rounded-full bg-fill-3 sm:hidden" />
        <div className="flex items-center justify-between gap-4 px-7 pt-6 max-sm:pt-4">
          <h2 className="font-display text-title2 font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="pressable focus-ring grid size-11 place-items-center rounded-full bg-fill-2 text-[1.1rem] text-ink-2 hover:bg-fill-3 [&_svg]:stroke-[2.25]"
          >
            <XmarkIcon />
          </button>
        </div>
      </div>
      <div className="px-7 pt-4 pb-7">{children}</div>
    </dialog>
  );
}

/**
 * Points the sheet's open and close animation at the control that opened it: the sheet starts as a small copy
 * centred on that control and grows into place. A centered form sheet's final centre is the viewport's, so
 * nothing has to be measured after it opens. Phones keep the bottom-sheet rise.
 */
function aimAt(dialog: HTMLDialogElement, source: Element | null) {
  const fromPhone = window.matchMedia("(max-width: 39.99rem)").matches;
  if (fromPhone || !source || source === document.body) {
    dialog.style.removeProperty("--sheet-from");
    return;
  }
  const box = source.getBoundingClientRect();
  const dx = box.left + box.width / 2 - window.innerWidth / 2;
  const dy = box.top + box.height / 2 - window.innerHeight / 2;
  dialog.style.setProperty("--sheet-from", `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(0.18)`);
}
