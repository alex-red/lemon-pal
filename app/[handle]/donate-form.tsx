"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AmountChips, Button, Card, HeartIcon, TextArea, TextField } from "@/components/kit";
import { NOTE_MAX } from "@/lib/donations";
import { currencyMark, formatMoney, parseCents, type Cents } from "@/lib/money";

type Props = {
  handle: string;
  currency: string;
  presetsCents: Cents[];
  allowCustom: boolean;
  minCents: Cents;
  maxCents: Cents;
  buttonLabel: string;
  notes: boolean;
  open: boolean;
  /** The seller looking at their own page. Everything works but the button, so no sale is created. */
  preview: boolean;
};

/** The donor picks or types an amount, leaves a note if the seller asks for one, and goes to the pay page. */
export function DonateForm({ handle, currency, presetsCents, allowCustom, minCents, maxCents, buttonLabel, notes, open, preview }: Props) {
  const router = useRouter();
  // Starts on the middle amount, the one most people pick, when there are presets. Otherwise on typing one.
  const [choice, setChoice] = useState<Cents | "other" | null>(
    presetsCents.length ? presetsCents[Math.floor((presetsCents.length - 1) / 2)] : allowCustom ? "other" : null,
  );
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  const typed = parseCents(custom);
  const amount = choice === "other" ? (typed !== null && !Number.isNaN(typed) ? typed : null) : choice;
  const customProblem =
    choice === "other" && custom.trim()
      ? amount === null
        ? "Enter an amount, such as 12 or 12.50."
        : amount < minCents || amount > maxCents
          ? `Choose from ${formatMoney(minCents, currency)} to ${formatMoney(maxCents, currency)}.`
          : null
      : null;
  const ready = open && !preview && amount !== null && !customProblem && !busy;

  async function give(event: FormEvent) {
    event.preventDefault();
    if (!ready || amount === null) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/store/${encodeURIComponent(handle)}/donations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: amount, ...(notes && note.trim() ? { note } : {}) }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (res?.ok && json?.saleId) return router.push(`/pay/${json.saleId}`, { transitionTypes: ["nav-forward"] });
    setBusy(false);
    setError({ message: json?.error ?? "Couldn’t start your gift. Check your connection and try again.", field: json?.field });
  }

  return (
    <Card className="flex flex-col gap-6 p-5 sm:p-6">
      <form onSubmit={give} className="flex flex-col gap-6">
        {presetsCents.length ? (
          <AmountChips
            label="How much to give"
            amounts={presetsCents}
            other={allowCustom && presetsCents.length > 0}
            currency={currency}
            value={choice}
            onChange={(next) => {
              setChoice(next);
              setError(null);
            }}
          />
        ) : null}
        {choice === "other" ? (
          <TextField
            label="Your amount"
            prefix={currencyMark(currency)}
            inputMode="decimal"
            enterKeyHint="go"
            autoFocus={presetsCents.length > 0}
            placeholder={centsPlaceholder(minCents)}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            error={customProblem ?? (error?.field === "amount" ? error.message : undefined)}
            hint={`${formatMoney(minCents, currency)} to ${formatMoney(maxCents, currency)}`}
          />
        ) : null}
        {notes ? (
          <TextArea
            label="Leave a note (optional)"
            rows={2}
            maxLength={NOTE_MAX}
            placeholder="Good luck with the fundraiser!"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            error={error?.field === "note" ? error.message : undefined}
            hint={`The seller may show it on their stand. No links or contact details. ${note.length} / ${NOTE_MAX}`}
          />
        ) : null}
        <Button type="submit" variant="filled" size="xl" icon={<HeartIcon />} disabled={!ready && !busy} loading={busy}>
          {amount !== null && !customProblem ? `${buttonLabel} ${formatMoney(amount, currency)}` : buttonLabel}
        </Button>
        {error && error.field !== "amount" && error.field !== "note" ? (
          <p role="alert" className="-mt-3 text-center text-subhead font-semibold text-berry">
            {error.message}
          </p>
        ) : null}
        <p className="-mt-3 text-center text-footnote text-ink-2">
          {preview
            ? "This is a preview. The button works for real visitors."
            : open
              ? "You’ll pay securely with PayPal. The seller never sees your card."
              : "This page isn’t taking gifts right now."}
        </p>
      </form>
    </Card>
  );
}

function centsPlaceholder(minCents: Cents) {
  return String(Math.max(1, Math.round(minCents / 100) * 5));
}
