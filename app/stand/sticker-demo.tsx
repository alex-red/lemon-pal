"use client";

import { useState } from "react";
import { Button, Sheet, SparklesIcon } from "@/components/kit";
import { standApi } from "@/lib/stands";

/**
 * Fills a demo account with the sticker shop, starting from the stand on screen. Resolves to an error message, or
 * null once it's loaded.
 */
export async function loadStickerDemo(standId: string): Promise<string | null> {
  try {
    const res = await fetch(standApi("/api/stand/demo", standId), {
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
  "This fills your demo account with Peel & Stick Club: 13 stickers with deals, market sales at your stand at events, an open online store with shipping, and a month of made-up orders. " +
  "It replaces those two stands’ items, the store settings and every sale. Demo sales never touch PayPal.";

export const FUNDRAISER_DEMO_TEXT =
  "This fills this donation stand with Keep Maple Hollow Warm, an animal rescue’s winter drive: a photo, a goal, three preset amounts, and three weeks of made-up gifts with donors’ notes, including two adoption days at the stand. " +
  "It replaces this stand’s page and every gift on it. Demo gifts never touch PayPal.";

/**
 * A button that asks first, then loads a demo and reloads the page to show it: the sticker shop, or on a donation
 * stand, the fundraiser.
 */
export function StickerDemoButton({ standId, fundraiser = false, className }: { standId: string; fundraiser?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    const problem = await loadStickerDemo(standId);
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
        {fundraiser ? "Load fundraiser demo" : "Load sticker shop demo"}
      </Button>
      <Sheet open={open} onClose={() => !busy && setOpen(false)} title={fundraiser ? "Load the fundraiser demo?" : "Load the sticker shop demo?"}>
        <p className="text-body text-ink-2">{fundraiser ? FUNDRAISER_DEMO_TEXT : STICKER_DEMO_TEXT}</p>
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
