import { formatMoney, type Cents } from "@/lib/money";
import { cn } from "./cn";

type Size = "hero" | "title" | "body";

const sizes: Record<Size, string> = {
  hero: "font-display text-hero font-semibold",
  title: "font-display text-title1 font-semibold",
  body: "text-body font-semibold",
};

/**
 * A price, set like a hand-lettered price tag: a small currency mark and cents raised beside big whole units.
 * Screen readers get the plain formatted amount. Numerals are tabular so totals don't jitter as they change.
 */
export function Money({
  cents,
  currency,
  size = "body",
  className,
}: {
  cents: Cents;
  currency: string;
  size?: Size;
  className?: string;
}) {
  const label = formatMoney(cents, currency);
  if (size === "body") {
    return <span className={cn(sizes.body, "tabular-nums", className)}>{label}</span>;
  }

  const parts = new Intl.NumberFormat(undefined, { style: "currency", currency }).formatToParts(cents / 100);
  return (
    <span className={cn(sizes[size], "inline-flex items-start tabular-nums", className)} aria-label={label} role="img">
      {parts.map((part, i) => {
        if (part.type === "currency") {
          return (
            <span key={i} aria-hidden className="mt-[0.12em] mr-[0.04em] text-[0.45em] leading-none text-ink-2">
              {part.value}
            </span>
          );
        }
        if (part.type === "decimal") return null;
        if (part.type === "fraction") {
          return (
            <span key={i} aria-hidden className="mt-[0.1em] ml-[0.04em] text-[0.45em] leading-none underline decoration-[0.06em] underline-offset-[0.18em]">
              {part.value}
            </span>
          );
        }
        if (part.type === "literal") return null;
        return (
          <span key={i} aria-hidden>
            {part.value}
          </span>
        );
      })}
    </span>
  );
}
