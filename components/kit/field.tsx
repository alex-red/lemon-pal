"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  label: string;
  /** Text inside the field before the value, such as a currency mark. */
  prefix?: ReactNode;
  hint?: ReactNode;
  /** Shown in place of the hint and announced to screen readers. */
  error?: ReactNode;
};

/** A labelled text field. The label stays visible while typing, so nobody has to remember what a box was for. */
export function TextField({ label, prefix, hint, error, className, id, ...props }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const noteId = `${inputId}-note`;
  const note = error ?? hint;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="px-1 text-footnote font-semibold text-ink-2">
        {label}
      </label>
      <div
        className={cn(
          // The inset edge identifies the field at 3:1 (WCAG 1.4.11); focus swaps it for a thicker ring.
          "flex h-12 items-center gap-1 rounded-field bg-fill px-4 text-body shadow-[inset_0_0_0_1px_var(--control-edge)] transition-[background-color,box-shadow] duration-200",
          "focus-within:bg-surface focus-within:shadow-[inset_0_0_0_2px_var(--focus)]",
          Boolean(error) && "shadow-[inset_0_0_0_2px_var(--berry)] focus-within:shadow-[inset_0_0_0_2px_var(--berry)]",
        )}
      >
        {prefix ? <span className="text-ink-2">{prefix}</span> : null}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3"
          {...props}
        />
      </div>
      {note ? (
        <p id={noteId} role={error ? "alert" : undefined} className={cn("px-1 text-footnote", error ? "text-berry" : "text-ink-2")}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: ReactNode };

/** A labelled multi-line field, styled like TextField, for pasting or typing a few lines. */
export function TextArea({ label, hint, error, className, id, rows = 5, ...props }: AreaProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const noteId = `${areaId}-note`;
  const note = error ?? hint;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={areaId} className="px-1 text-footnote font-semibold text-ink-2">
        {label}
      </label>
      <textarea
        id={areaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          "min-h-28 resize-y rounded-field bg-fill px-4 py-3 text-body shadow-[inset_0_0_0_1px_var(--control-edge)] outline-none transition-[background-color,box-shadow] duration-200 placeholder:text-ink-3",
          "focus:bg-surface focus:shadow-[inset_0_0_0_2px_var(--focus)]",
          Boolean(error) && "shadow-[inset_0_0_0_2px_var(--berry)] focus:shadow-[inset_0_0_0_2px_var(--berry)]",
        )}
        {...props}
      />
      {note ? (
        <p id={noteId} role={error ? "alert" : undefined} className={cn("px-1 text-footnote", error ? "text-berry" : "text-ink-2")}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
