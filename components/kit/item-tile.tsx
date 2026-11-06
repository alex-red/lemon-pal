import { formatMoney, type Cents } from "@/lib/money";
import { cn } from "./cn";
import { MinusIcon, TagIcon, XmarkIcon } from "./icons";
import { Money } from "./money";
import { CountBadge, Pill } from "./status";

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
  image,
  deal,
  soldOut = false,
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
  /** Optional thumbnail cropped from the seller's photo. Fills the tile in place of the emoji, fading out behind the name. */
  image?: string;
  /** A multi-buy price to show under the price, such as "2 for $5.00". */
  deal?: string;
  /** Out of stock: the tile greys out, says so, and can't be tapped. */
  soldOut?: boolean;
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
        disabled={soldOut}
        aria-label={soldOut ? `${name}, ${price}, sold out.` : `${name}, ${price}${deal ? `, deal ${deal}` : ""}${active ? `, ${count} in sale` : ""}. Add one.`}
        className={cn(
          "pressable focus-ring relative flex min-w-0 flex-col justify-between gap-3 overflow-hidden rounded-tile p-5 text-left [grid-area:1/1] max-[24rem]:p-4",
          "ring-[0.5px]",
          soldOut
            ? "pointer-events-none bg-surface text-ink-2 shadow-card ring-hairline [&>img]:opacity-40 [&>img]:grayscale [&>span[aria-hidden]]:opacity-40 [&>span[aria-hidden]]:grayscale"
            : active
            ? "bg-lemon text-[oklch(0.23_0.03_85)] shadow-float ring-lemon-deep"
            : "bg-surface text-ink shadow-card ring-hairline hover:shadow-float",
        )}
      >
        {image ? (
          // The photo fills the tile and fades into it above the name, so it reads as part of the card.
          // The empty span keeps the name and price at the bottom, as with an emoji.
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- small data URL thumbnail */}
            <img
              src={image}
              alt=""
              className="pointer-events-none absolute inset-0 size-full object-cover [mask-image:linear-gradient(to_bottom,#000_25%,transparent_72%)]"
            />
            <span aria-hidden />
          </>
        ) : emoji ? (
          <span aria-hidden className="text-[2.5rem] leading-none drop-shadow-sm">
            {emoji}
          </span>
        ) : (
          // No glyph from the sign: the initial, set large and faint, so tiles are told apart at a glance.
          <span aria-hidden className="font-display text-[3rem] leading-none font-semibold opacity-25">
            {name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span className="relative flex flex-col gap-1">
          <span className="text-title3 font-semibold text-balance [overflow-wrap:anywhere]">{name}</span>
          <Money cents={priceCents} currency={currency} size="title" className={active ? "[&>span]:text-current" : undefined} />
          {soldOut ? (
            <Pill tone="berry" icon={<XmarkIcon />} className="mt-1 self-start">
              Sold out
            </Pill>
          ) : deal ? (
            <span
              aria-hidden
              className={cn(
                "mt-1 inline-flex h-7 items-center gap-1.5 self-start rounded-full px-3 text-footnote font-semibold whitespace-nowrap [&_svg]:text-[1.15em]",
                // Text on lemon is always dark, so the active tile keeps a dark label in dark mode too.
                active ? "bg-[oklch(0.23_0.03_85/0.1)] text-[oklch(0.23_0.03_85)]" : "bg-lemon-soft text-peel",
              )}
            >
              <TagIcon /> {deal}
            </span>
          ) : null}
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
