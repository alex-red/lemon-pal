import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { CheckIcon, ChevronRightIcon } from "./icons";

/** An inset grouped list, the Settings pattern: a header, rounded rows, a footer that explains. */
export function GroupedList({
  header,
  footer,
  children,
  className,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      {header ? <h3 className="px-5 text-footnote font-semibold uppercase tracking-[0.06em] text-ink-2">{header}</h3> : null}
      <ul className="overflow-hidden rounded-card bg-surface shadow-card ring-[0.5px] ring-hairline">{children}</ul>
      {footer ? <p className="px-5 text-footnote text-ink-2">{footer}</p> : null}
    </section>
  );
}

const iconTones = {
  lemon: "bg-lemon text-[oklch(0.23_0.03_85)]",
  leaf: "bg-leaf text-on-accent",
  pool: "bg-pool text-on-accent",
  berry: "bg-berry text-on-accent",
  ink: "bg-ink text-on-ink",
} as const;

/**
 * One row. Separators start after the leading icon, so the icon column reads as one unbroken edge.
 * Pass href to make the whole row a link; the chevron then appears on its own.
 */
export function ListRow({
  icon,
  iconTone = "lemon",
  title,
  subtitle,
  trailing,
  href,
  onClick,
  current,
}: {
  icon?: ReactNode;
  iconTone?: keyof typeof iconTones;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  /** Makes the row a button, for a choice made in place, such as picking from a sheet. */
  onClick?: () => void;
  /** Marks the chosen row in a list of choices, with a check. */
  current?: boolean;
}) {
  const body = (
    <>
      {icon ? (
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-[9px] text-[1.15rem] [&_svg]:stroke-[2]",
            iconTones[iconTone],
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 shadow-[0_0.5px_0_0_var(--hairline)] group-last:shadow-none">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body">{title}</span>
          {subtitle ? <span className="block truncate text-subhead text-ink-2">{subtitle}</span> : null}
        </span>
        {trailing ? <span className="shrink-0 text-body text-ink-2 tabular-nums">{trailing}</span> : null}
        {current ? <CheckIcon strokeWidth={2.5} className="shrink-0 text-[1.1rem] text-peel" /> : null}
        {href ? <ChevronRightIcon className="shrink-0 text-[1.1rem] text-ink-3" /> : null}
      </span>
    </>
  );

  const rowClass = "flex items-center gap-3.5 pl-4";
  return (
    <li className="group">
      {href ? (
        // A row with a chevron drills in, so it slides the next page in from the trailing edge.
        <Link href={href} transitionTypes={["nav-forward"]} className={cn(rowClass, "focus-ring transition-colors active:bg-fill-2 hover:bg-fill")}>
          {body}
        </Link>
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-current={current || undefined}
          className={cn(rowClass, "focus-ring w-full text-left transition-colors active:bg-fill-2 hover:bg-fill")}
        >
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}
