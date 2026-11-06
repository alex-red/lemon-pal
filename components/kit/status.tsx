import type { ReactNode } from "react";
import type { SaleStatus } from "@/lib/types";
import { cn } from "./cn";
import { ArrowUturnIcon, CheckIcon, ClockIcon, ExclamationIcon, SparklesIcon, StopwatchIcon, XmarkIcon } from "./icons";

type Tone = "neutral" | "lemon" | "leaf" | "pool" | "berry";

const sizes = {
  md: "h-7 gap-1.5 px-3 text-footnote",
  lg: "h-11 gap-2 px-5 text-headline",
};

const tones: Record<Tone, string> = {
  neutral: "bg-fill-2 text-ink-2",
  lemon: "bg-lemon-soft text-peel",
  leaf: "bg-leaf-soft text-leaf",
  pool: "bg-pool-soft text-pool",
  berry: "bg-berry-soft text-berry",
};

/** A small capsule label. Always pair the color with an icon or a word: color alone isn't a signal. */
export function Pill({
  tone = "neutral",
  size = "md",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  size?: keyof typeof sizes;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold [&_svg]:text-[1.15em]",
        sizes[size],
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

const saleStatus: Record<SaleStatus, { tone: Tone; icon: ReactNode; label: string }> = {
  open: { tone: "pool", icon: <ClockIcon />, label: "Waiting to pay" },
  paid: { tone: "leaf", icon: <CheckIcon strokeWidth={2.25} />, label: "Paid" },
  canceled: { tone: "neutral", icon: <XmarkIcon />, label: "Canceled" },
  refunded: { tone: "berry", icon: <ArrowUturnIcon />, label: "Refunded" },
};

export function SaleStatusPill({ status, size, className }: { status: SaleStatus; size?: keyof typeof sizes; className?: string }) {
  const s = saleStatus[status];
  return (
    <Pill tone={s.tone} size={size} icon={s.icon} className={className}>
      {s.label}
    </Pill>
  );
}

/** How sure the sign reader was. Low confidence asks the seller to look, it never blocks them. */
export function ConfidencePill({ confidence, className }: { confidence: "high" | "low"; className?: string }) {
  return confidence === "high" ? (
    <Pill tone="leaf" icon={<SparklesIcon />} className={className}>
      Read clearly
    </Pill>
  ) : (
    <Pill tone="lemon" icon={<ExclamationIcon />} className={className}>
      Check this
    </Pill>
  );
}

/** Formats whole seconds as a stopwatch reads: 0:52, 12:05, 1:02:05. */
export function formatStopwatch(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

function spokenDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const parts = [
    [Math.floor(s / 3600), "hour"],
    [Math.floor((s % 3600) / 60), "minute"],
    [s % 60, "second"],
  ] as const;
  const said = parts.filter(([n]) => n > 0).map(([n, unit]) => `${n} ${unit}${n === 1 ? "" : "s"}`);
  return said.length ? said.join(" ") : "0 seconds";
}

/** How long the stand took from reading its sign to its first paid sale. */
export function FirstSalePill({
  seconds,
  size = "md",
  className,
}: {
  seconds: number;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <Pill tone="lemon" size={size} icon={<StopwatchIcon />} className={className}>
      <span aria-hidden>
        First sale in <span className="font-price tabular-nums">{formatStopwatch(seconds)}</span>
      </span>
      <span className="sr-only">First sale {spokenDuration(seconds)} after reading the sign</span>
    </Pill>
  );
}

/** A count bubble, like an app badge. Hidden from assistive tech: say the count in the parent's label. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-8 min-w-8 animate-pop items-center justify-center rounded-full bg-ink px-2.5 text-callout font-bold tabular-nums text-on-ink shadow-card",
        className,
      )}
    >
      {count}
    </span>
  );
}
