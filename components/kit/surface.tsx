import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type Material = "thin" | "regular" | "thick";

const materials: Record<Material, string> = {
  thin: "glass-thin",
  regular: "glass",
  thick: "glass-thick",
};

/**
 * Liquid glass for chrome that floats above content: toolbars, sidebars, sheets, the total bar.
 * Set the corner radius with className. Content itself sits on Cards. Glass on glass muddies both, so don't nest them.
 */
export function Glass({
  material = "regular",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { material?: Material }) {
  return <div className={cn(materials[material], className)} {...props} />;
}

/** An opaque, softly lifted surface for content: a receipt, a grouped list, a form. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card bg-surface shadow-card ring-[0.5px] ring-hairline", className)} {...props} />;
}

/** A floating capsule of actions, like the iPadOS 26 toolbar. Position it with className. */
export function Toolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="toolbar"
      className={cn("glass flex items-center gap-1.5 rounded-full p-1.5", className)}
      {...props}
    />
  );
}
