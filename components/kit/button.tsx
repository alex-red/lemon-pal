import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "filled" | "lemon" | "tinted" | "glass" | "ghost" | "plain" | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const variants: Record<ButtonVariant, string> = {
  // One filled button per screen: the action the person came to do.
  filled: "bg-ink text-on-ink shadow-card hover:bg-ink/90",
  lemon: "bg-lemon text-[oklch(0.23_0.03_85)] shadow-card hover:bg-lemon-deep",
  tinted: "bg-fill-2 text-ink hover:bg-fill-3",
  glass: "glass text-ink",
  // For buttons inside a Toolbar or other glass, where a fill of their own would double up.
  ghost: "text-ink hover:bg-fill-2",
  plain: "text-peel hover:bg-fill",
  destructive: "bg-berry-soft text-berry hover:bg-berry/20",
};

// md and up meet the 44pt minimum. sm is 36pt tall and extends its hit area with an invisible halo.
const sizes: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 px-3.5 text-subhead font-semibold [&_svg]:text-[1.05em] relative after:absolute after:-inset-1 after:content-['']",
  md: "h-11 gap-2 px-5 text-callout font-semibold [&_svg]:text-[1.15em]",
  lg: "h-14 gap-2.5 px-7 text-headline [&_svg]:text-[1.25em]",
  xl: "h-[4.5rem] gap-3 px-9 text-title3 font-semibold [&_svg]:text-[1.2em]",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** Shows a spinner and blocks repeat taps while a request is in flight. */
  loading?: boolean;
  /** Square, icon-only button. Pass an aria-label. */
  iconOnly?: boolean;
};

export function Button({
  variant = "tinted",
  size = "md",
  icon,
  loading = false,
  iconOnly = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "pressable focus-ring inline-flex shrink-0 select-none items-center justify-center rounded-full whitespace-nowrap",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        sizes[size],
        iconOnly && "aspect-square px-0",
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="text-[1.1em]" /> : icon}
      {children}
    </button>
  );
}
