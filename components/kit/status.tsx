import type { ReactNode } from "react";
import type { SaleStatus } from "@/lib/types";
import { cn } from "./cn";
import { CheckIcon, ClockIcon, ExclamationIcon, SparklesIcon, XmarkIcon } from "./icons";

type Tone = "neutral" | "lemon" | "leaf" | "pool" | "berry";

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
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-footnote font-semibold [&_svg]:text-[1.15em]",
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
};

export function SaleStatusPill({ status, className }: { status: SaleStatus; className?: string }) {
  const s = saleStatus[status];
  return (
    <Pill tone={s.tone} icon={s.icon} className={className}>
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
