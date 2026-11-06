import type { CSSProperties } from "react";
import { formatMoney, type Cents } from "@/lib/money";
import { cn } from "./cn";

type Size = "hero" | "title" | "body" | "inline";

const sizes: Record<Size, string> = {
  hero: "font-price text-hero font-bold",
  title: "font-price text-title1 font-bold",
  body: "text-body font-semibold",
  /** Takes the surrounding text's size, for an amount inside a sentence or a pill. */
  inline: "font-semibold",
};

/**
 * A price, set like a price tag: a small currency mark and cents raised beside big whole units.
 * Screen readers get the plain formatted amount. font-price has fixed-width digits, so totals don't jitter.
 * `rolling` makes each digit roll to its new value like an odometer, for a total that changes as you tap.
 */
export function Money({
  cents,
  currency,
  size = "body",
  rolling = false,
  className,
}: {
  cents: Cents;
  currency: string;
  size?: Size;
  rolling?: boolean;
  className?: string;
}) {
  const label = formatMoney(cents, currency);
  if (size === "body" || size === "inline") {
    return <span className={cn(sizes[size], "tabular-nums", className)}>{label}</span>;
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
              {rolling ? <Digits text={part.value} /> : part.value}
            </span>
          );
        }
        if (part.type === "literal") return null;
        return (
          <span key={i} aria-hidden>
            {rolling ? <Digits text={part.value} /> : part.value}
          </span>
        );
      })}
    </span>
  );
}

const STRIP = Array.from({ length: 10 }, (_, d) => d);

/** Each digit is a 0–9 strip that slides to its value. Keyed from the right, so ones stay ones as the total grows. */
function Digits({ text }: { text: string }) {
  const chars = [...text];
  return chars.map((char, i) => {
    const place = chars.length - i;
    if (!/\d/.test(char)) return <span key={`sep-${place}`}>{char}</span>;
    return (
      <span key={place} className="digit-roll">
        <span style={{ "--digit": char } as CSSProperties}>
          {STRIP.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </span>
      </span>
    );
  });
}
