"use client";

import { useState } from "react";
import { Button, Sheet, SparklesIcon } from "@/components/kit";

/** Fills the stand with the sticker shop demo. Resolves to an error message, or null once it's loaded. */
export async function loadStickerDemo(): Promise<string | null> {
  try {
    const res = await fetch("/api/stand/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The server lays out market hours in the seller's own time zone.
      body: JSON.stringify({ tzOffsetMinutes: new Date().getTimezoneOffset() }),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? "The demo couldn’t load. Try again.";
  } catch {
    return "The demo couldn’t load. Check your connection and try again.";
  }
}

export const STICKER_DEMO_TEXT =
  "This fills the stand with Peel & Stick Club: 13 stickers with deals, an open online store with shipping, and a month of made-up sales and orders. " +
  "It replaces the current items, store settings and every sale. Demo sales never touch PayPal.";

/** A button that asks first, then loads the sticker shop demo and reloads the page to show it. */
export function StickerDemoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    const problem = await loadStickerDemo();
    if (problem) {
      setError(problem);
      setBusy(false);
      return;
    }
    // The page holds its data in state from the first render, so reload to start from the demo.
    window.location.reload();
  }

  return (
    <>
      <Button variant="plain" icon={<SparklesIcon />} className={className} onClick={() => setOpen(true)}>
        Load sticker shop demo
      </Button>
      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="Load the sticker shop demo?">
        <p className="text-body text-ink-2">{STICKER_DEMO_TEXT}</p>
        {error ? (
          <p role="alert" className="mt-3 text-subhead text-berry">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="tinted" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="filled" icon={<SparklesIcon />} loading={busy} onClick={load}>
            Load demo
          </Button>
        </div>
      </Sheet>
    </>
  );
}
