"use client";

import { useId, type ReactNode } from "react";
import { cn } from "./cn";
import { MinusIcon, PlusIcon } from "./icons";

/** A segmented control with a glass thumb that springs between options. Use for 2–5 peer views. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers. */
  label: string;
  className?: string;
}) {
  const name = useId();
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("relative grid h-11 auto-cols-fr grid-flow-col rounded-full bg-fill-2 p-1", className)}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full bg-surface shadow-card ring-[0.5px] ring-hairline transition-transform duration-500 ease-spring"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "pressable relative z-10 flex cursor-pointer items-center justify-center rounded-full px-4 text-subhead font-semibold",
            "has-[:focus-visible]:shadow-[0_0_0_3px_var(--lemon-deep)]",
            option.value === value ? "text-ink" : "text-ink-2",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

/** An on/off switch. Changes take effect at once, so never pair one with a Save button. */
export function Switch({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-ring relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-300",
        "after:absolute after:-inset-1.5 after:content-['']",
        checked ? "bg-leaf" : "bg-fill-3",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)]",
          "transition-[transform,width] duration-500 ease-spring active:w-[33px]",
          checked && "translate-x-5 active:translate-x-[14px]",
        )}
      />
    </button>
  );
}

/** A minus / count / plus capsule. The count is announced politely as it changes. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** What is being counted, e.g. "Lemonade". */
  label: string;
  className?: string;
}) {
  const step = "pressable focus-ring grid size-11 place-items-center rounded-full text-[1.2rem] text-ink hover:bg-fill-2 disabled:opacity-30 [&_svg]:stroke-[2.25]";
  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center rounded-full bg-fill-2 p-0.5", className)}>
      <button type="button" className={step} aria-label={`One less ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <MinusIcon />
      </button>
      <output aria-live="polite" className="w-9 text-center text-headline tabular-nums">
        {value}
      </output>
      <button type="button" className={step} aria-label={`One more ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <PlusIcon />
      </button>
    </div>
  );
}
