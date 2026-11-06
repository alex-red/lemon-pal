"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn";
import { XmarkIcon } from "./icons";

/**
 * A modal sheet built on <dialog>, so focus trapping, Escape and an inert background come from the browser.
 * It rises from the bottom edge on phones and floats as a centered form sheet on iPad and desktop.
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

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

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
      <div className="flex items-center justify-between gap-4 px-7 pt-6">
        <h2 className="font-display text-title2 font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="pressable focus-ring grid size-9 place-items-center rounded-full bg-fill-2 text-[1.1rem] text-ink-2 hover:bg-fill-3 [&_svg]:stroke-[2.25]"
        >
          <XmarkIcon />
        </button>
      </div>
      <div className="px-7 pt-4 pb-7">{children}</div>
    </dialog>
  );
}
