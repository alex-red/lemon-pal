import type { ReactNode } from "react";
import { cn } from "./cn";

const shapes = {
  card: "rounded-card",
  field: "rounded-field",
  tile: "rounded-tile",
  sheet: "rounded-sheet",
  pill: "rounded-full",
} as const;

/**
 * Lights the edge of whatever Lemon Pal is working on, like Apple Intelligence: a lemon and leaf glow
 * travels around it while `active`, then fades. Match `shape` to the child's corner radius.
 * It's decoration only, so pair it with words (ShimmerText) that say what's happening.
 */
export function AIGlow({
  active,
  shape = "card",
  children,
  className,
}: {
  active: boolean;
  shape?: keyof typeof shapes;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative isolate", shapes[shape], className)}>
      <span aria-hidden data-active={active || undefined} className="ai-glow absolute inset-0 -z-10" />
      {children}
    </div>
  );
}

/** Words that shimmer while the AI works ("Reading your sign…"). They read normally to screen readers. */
export function ShimmerText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("shimmer-text", className)}>{children}</span>;
}
