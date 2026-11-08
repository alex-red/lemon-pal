import { Button } from "./button";
import { cn } from "./cn";
import { ArrowUturnIcon, CheckIcon, ExclamationIcon, XmarkIcon } from "./icons";
import { Pill } from "./status";
import { Card } from "./surface";

/** One row of what Pal changed or wants to change. A line with `before` reads as before → after. */
export type PalCardLine = { label: string; before?: string; after?: string };

export type PalUndoState = "idle" | "undoing" | "undone" | { error: string };
export type PalConfirmState = "idle" | "working" | "done" | "declined" | { error: string };

function Lines({ lines }: { lines: PalCardLine[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {lines.map((line, i) => (
        <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 text-subhead">
          <span className="text-ink-2">{line.label}</span>
          <span className="min-w-0 font-price tabular-nums wrap-anywhere">
            {line.before ? (
              <>
                <span className="text-ink-3 line-through">{line.before}</span>
                <span aria-hidden className="mx-1.5 text-ink-3">→</span>
                <span className="sr-only"> to </span>
              </>
            ) : null}
            <span className="font-semibold">{line.after}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Problem({ children }: { children: string }) {
  return (
    <span role="alert" className="flex items-center gap-1.5 text-footnote font-semibold text-berry">
      <ExclamationIcon className="shrink-0" /> {children}
    </span>
  );
}

/** Something Pal already changed, before and after, with a way to put it back. */
export function PalChangeCard({
  title,
  lines,
  state = "idle",
  onUndo,
}: {
  title: string;
  lines: PalCardLine[];
  state?: PalUndoState;
  /** Leave out for a change that can't be undone. */
  onUndo?: () => void;
}) {
  const undone = state === "undone";
  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="flex items-center gap-2 text-headline font-semibold">
        {undone ? <ArrowUturnIcon className="shrink-0 text-ink-2" /> : <CheckIcon className="shrink-0 text-leaf" />}
        <span className={cn("min-w-0", undone && "text-ink-2 line-through")}>{title}</span>
      </p>
      {lines.length > 1 || lines[0]?.before ? <Lines lines={lines} /> : null}
      {onUndo ? (
        <div className="flex flex-wrap items-center gap-3">
          {undone ? (
            <span className="text-subhead font-semibold text-ink-2">Undone</span>
          ) : (
            <Button variant="tinted" size="sm" icon={<ArrowUturnIcon />} loading={state === "undoing"} onClick={onUndo}>
              Undo
            </Button>
          )}
          {typeof state === "object" ? <Problem>{state.error}</Problem> : null}
        </div>
      ) : null}
    </Card>
  );
}

/**
 * Something Pal won't do by itself, waiting for the seller's tap: a refund, a shipped order, a deletion. `danger`
 * makes the confirm button red, for what can't be taken back.
 */
export function PalProposalCard({
  title,
  lines,
  confirm,
  danger = false,
  state = "idle",
  onConfirm,
  onDismiss,
}: {
  title: string;
  lines: PalCardLine[];
  /** The confirm button's words, such as "Refund $4.00". */
  confirm: string;
  danger?: boolean;
  state?: PalConfirmState;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const settled = state === "done" || state === "declined";
  return (
    <Card className={cn("flex flex-col gap-3 p-4", danger && !settled && "ring-1 ring-berry/40")}>
      <p className="flex items-center gap-2 text-headline font-semibold">
        {state === "done" ? (
          <CheckIcon className="shrink-0 text-leaf" />
        ) : state === "declined" ? (
          <XmarkIcon className="shrink-0 text-ink-2" />
        ) : (
          <ExclamationIcon className={cn("shrink-0", danger ? "text-berry" : "text-peel")} />
        )}
        <span className={cn("min-w-0", state === "declined" && "text-ink-2")}>{title}</span>
      </p>
      <Lines lines={lines} />
      {state === "done" ? (
        <Pill tone="leaf" icon={<CheckIcon />} className="self-start">
          Done
        </Pill>
      ) : state === "declined" ? (
        <Pill icon={<XmarkIcon />} className="self-start">
          Not done
        </Pill>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={danger ? "destructive" : "lemon"} loading={state === "working"} onClick={onConfirm}>
            {confirm}
          </Button>
          <Button variant="plain" disabled={state === "working"} onClick={onDismiss}>
            Not now
          </Button>
          {typeof state === "object" ? <Problem>{state.error}</Problem> : null}
        </div>
      )}
    </Card>
  );
}
