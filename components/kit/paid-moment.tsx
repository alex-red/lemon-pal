import type { Cents } from "@/lib/money";
import { cn } from "./cn";
import { CheckIcon } from "./icons";
import { Money } from "./money";
import { PalMascot } from "./pal-mascot";

/**
 * The moment a sale is confirmed: Pal pops up smiling with a green check, and the register plays its ding.
 * It has to read from across the stand, so it uses size, shape, color and a word together.
 * Mount it only after a verified capture.
 */
export function PaidMoment({
  cents,
  currency,
  caption = "Thank you!",
  className,
}: {
  cents: Cents;
  currency: string;
  caption?: string;
  className?: string;
}) {
  return (
    <div role="status" className={cn("flex flex-col items-center gap-5 text-center", className)}>
      <div className="relative grid size-44 place-items-center">
        <span aria-hidden className="absolute inset-4 animate-ripple rounded-full bg-lemon" />
        <span aria-hidden className="absolute inset-4 animate-ripple rounded-full bg-leaf [animation-delay:240ms]" />
        <span className="relative size-full animate-pop">
          <PalMascot className="size-full animate-wiggle drop-shadow-lg [animation-delay:650ms]" />
          <span className="absolute right-3 bottom-4 grid size-14 animate-pop place-items-center rounded-full bg-leaf text-[2rem] text-on-accent shadow-lift ring-4 ring-canvas [animation-delay:350ms]">
            <CheckIcon strokeWidth={3} />
          </span>
        </span>
      </div>
      <p className="animate-rise font-display text-large-title font-semibold text-leaf [animation-delay:120ms]">Paid</p>
      <Money cents={cents} currency={currency} size="title" className="animate-rise [animation-delay:200ms]" />
      <p className="animate-rise text-body text-ink-2 [animation-delay:280ms]">{caption}</p>
    </div>
  );
}
