"use client";

import { useId, type ReactNode } from "react";
import { formatMoney, type Cents } from "@/lib/money";
import type { StorefrontAccent } from "@/lib/types";
import { cn } from "./cn";
import { HeartIcon, LemonIcon } from "./icons";
import { Money } from "./money";

const washes: Record<StorefrontAccent, string> = {
  lemon: "bg-linear-to-br from-lemon to-lemon-deep text-[oklch(0.23_0.03_85)]",
  leaf: "bg-linear-to-br from-leaf to-leaf/70 text-on-accent",
  berry: "bg-linear-to-br from-berry to-berry/70 text-on-accent",
};

/**
 * One-tap gift amounts, and an Other choice when the donor may type their own. A radio group, so arrow keys move
 * between amounts. `value` is the chosen amount in cents, "other", or null before a choice.
 */
export function AmountChips({
  amounts,
  currency,
  value,
  onChange,
  other = false,
  label = "Amount",
  className,
}: {
  amounts: Cents[];
  currency: string;
  value: Cents | "other" | null;
  onChange: (value: Cents | "other") => void;
  /** Adds an Other chip. */
  other?: boolean;
  label?: string;
  className?: string;
}) {
  const name = useId();
  const choices: Array<Cents | "other"> = [...amounts, ...(other ? (["other"] as const) : [])];
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(7rem,1fr))]", className)}>
      {choices.map((choice) => {
        const checked = value === choice;
        return (
          <label
            key={String(choice)}
            className={cn(
              "pressable flex h-16 cursor-pointer items-center justify-center rounded-field px-4 text-title3 font-semibold transition-[background-color,box-shadow,color] duration-200 ease-glide",
              "has-[:focus-visible]:shadow-[0_0_0_3px_var(--focus)]",
              checked ? "bg-ink text-on-ink shadow-card" : "bg-fill-2 text-ink hover:bg-fill-3",
            )}
          >
            <input type="radio" name={name} className="sr-only" checked={checked} onChange={() => onChange(choice)} />
            {choice === "other" ? "Other" : <span className="font-price tabular-nums">{formatMoney(choice, currency)}</span>}
          </label>
        );
      })}
    </div>
  );
}

/** How close a fundraiser is to its goal: a bar, and the amounts in words, so it never relies on the bar alone. */
export function GoalBar({ raisedCents, goalCents, currency, className }: { raisedCents: Cents; goalCents: Cents; currency: string; className?: string }) {
  const share = Math.min(1, raisedCents / goalCents);
  const percent = Math.round((raisedCents / goalCents) * 100);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
        aria-valuetext={`${formatMoney(raisedCents, currency)} of ${formatMoney(goalCents, currency)} raised`}
        className="h-3 overflow-hidden rounded-full bg-fill-2"
      >
        <div className="h-full rounded-full bg-leaf transition-[width] duration-700 ease-smooth" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-subhead text-ink-2" aria-hidden>
        <span>
          <Money cents={raisedCents} currency={currency} size="inline" className="text-ink" /> of{" "}
          <Money cents={goalCents} currency={currency} size="inline" /> raised
        </span>
        <span className="font-semibold tabular-nums">{percent}%</span>
      </p>
    </div>
  );
}

/**
 * A donation stand's poster: the seller's photo, title and message around one big code. The display screen, the
 * printed poster and the editor's preview all render it, so what the seller sets up is what people see.
 */
export function DonationPoster({
  title,
  intro,
  bannerUrl,
  accent,
  code,
  caption,
  goal,
  closed = false,
  layout = "auto",
  children,
  className,
}: {
  title: string;
  intro?: string;
  bannerUrl?: string | null;
  accent: StorefrontAccent;
  /** The QR code, already sized. */
  code: ReactNode;
  /** Under the code, such as "Scan to donate with PayPal". */
  caption: string;
  goal?: { raisedCents: Cents; goalCents: Cents; currency: string } | null;
  closed?: boolean;
  /** "auto" puts the code beside the message on wide or short screens. "stacked" always puts it below, for a narrow preview. */
  layout?: "auto" | "stacked";
  /** Anything below the poster's message, such as recent notes. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "grid items-center gap-6 rounded-card bg-surface ring-[0.5px] ring-hairline",
        layout === "auto"
          ? "p-5 shadow-card sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10 short:grid-cols-[minmax(0,1fr)_auto] short:gap-6 short:p-4"
          : "p-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-5 short:gap-3">
        <div className={cn("relative aspect-[3/1] overflow-hidden rounded-[22px] ring-[0.5px] ring-hairline", !bannerUrl && washes[accent])}>
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a seller photo served by our own route, or a data URL in the editor
            <img src={bannerUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <HeartIcon aria-hidden className="absolute top-1/2 right-[6%] -translate-y-1/2 text-[min(8rem,20vw)] opacity-30" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-large-title font-semibold text-balance [overflow-wrap:anywhere]">{title || "Your fundraiser"}</h2>
          {intro ? <p className="max-w-2xl text-body whitespace-pre-line text-ink-2">{intro}</p> : null}
        </div>
        {goal ? <GoalBar {...goal} /> : null}
        {children}
      </div>
      <div className="flex flex-col items-center gap-3 justify-self-center">
        <div className={cn("rounded-[34px] bg-lemon p-4 shadow-float", closed && "opacity-40")}>{code}</div>
        <p className="flex items-center gap-1.5 text-center text-callout font-semibold">
          {closed ? (
            "Not taking gifts right now"
          ) : (
            <>
              <LemonIcon aria-hidden className="text-[1.1em] text-peel" /> {caption}
            </>
          )}
        </p>
      </div>
    </article>
  );
}
