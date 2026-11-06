import { formatMoney, type Cents } from "@/lib/money";
import { cn } from "./cn";
import { MinusIcon } from "./icons";
import { Money } from "./money";
import { CountBadge } from "./status";

/**
 * A register tile: the biggest target on the seller's screen, sized for a thumb in a hurry (Fitts's law).
 * Tap adds one. Once something is in the cart a minus appears, so a mis-tap is one tap to undo.
 * Inner radii are concentric with the tile: tile radius minus the 12px inset.
 */
export function ItemTile({
  name,
  priceCents,
  currency,
  count = 0,
  emoji,
  onAdd,
  onRemove,
  className,
}: {
  name: string;
  priceCents: Cents;
  currency: string;
  count?: number;
  /** Optional glyph from the sign, shown large. */
  emoji?: string;
  onAdd?: () => void;
  onRemove?: () => void;
  className?: string;
}) {
  const active = count > 0;
  const price = formatMoney(priceCents, currency);

  return (
    // A spacer holds the 5:4 shape and the button shares its grid cell, so the tile grows taller than 5:4
    // when a long name needs it on a narrow phone, instead of clipping the name.
    // The spacer sits at the top of the cell: stretched to a taller row, its ratio would widen the tile instead.
    <div className={cn("relative grid min-h-32 min-w-0", className)}>
      <span aria-hidden className="pointer-events-none aspect-[5/4] self-start [grid-area:1/1]" />
      <button
        type="button"
        onClick={onAdd}
        aria-label={`${name}, ${price}${active ? `, ${count} in sale` : ""}. Add one.`}
        className={cn(
          "pressable focus-ring flex min-w-0 flex-col justify-between gap-3 overflow-hidden rounded-tile p-5 text-left [grid-area:1/1] max-[24rem]:p-4",
          "ring-[0.5px]",
          active
            ? "bg-lemon text-[oklch(0.23_0.03_85)] shadow-float ring-lemon-deep"
            : "bg-surface text-ink shadow-card ring-hairline hover:shadow-float",
        )}
      >
        {emoji ? (
          <span aria-hidden className="text-[2.5rem] leading-none drop-shadow-sm">
            {emoji}
          </span>
        ) : (
          // No glyph from the sign: the initial, set large and faint, so tiles are told apart at a glance.
          <span aria-hidden className="font-display text-[3rem] leading-none font-semibold opacity-25">
            {name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span className="flex flex-col gap-1">
          <span className="text-title3 font-semibold text-balance [overflow-wrap:anywhere]">{name}</span>
          <Money cents={priceCents} currency={currency} size="title" className={active ? "[&>span]:text-current" : undefined} />
        </span>
      </button>

      {active ? <CountBadge key={count} count={count} className="pointer-events-none absolute top-3 right-3" /> : null}

      {active && onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove one ${name}`}
          className={cn(
            "pressable focus-ring absolute right-3 bottom-3 grid size-11 animate-pop place-items-center",
            // Concentric: 30px tile radius − 12px inset = 18px.
            "rounded-[18px] bg-[oklch(0.23_0.03_85/0.1)] text-[1.25rem] text-[oklch(0.23_0.03_85)] hover:bg-[oklch(0.23_0.03_85/0.16)] [&_svg]:stroke-[2.25]",
          )}
        >
          <MinusIcon />
        </button>
      ) : null}
    </div>
  );
}
