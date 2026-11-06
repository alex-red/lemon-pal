"use client";

import { useState } from "react";
import { ArrowUturnIcon, Button, Sheet, SparklesIcon } from "@/components/kit";
import { loadStickerDemo, STICKER_DEMO_TEXT } from "../sticker-demo";

/**
 * Lets a judge start the demo over: the sample catalog comes back and test sales are deleted.
 * Or fill it instead, with the sticker shop and a month of sales for the dashboard.
 */
export function ResetDemo() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"reset" | "stickers" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function stickers() {
    setBusy("stickers");
    setError(null);
    const problem = await loadStickerDemo();
    if (problem) {
      setError(problem);
      setBusy(null);
      return;
    }
    window.location.reload();
  }

  async function reset() {
    setBusy("reset");
    await fetch("/api/stand?sales=clear", { method: "DELETE" });
    // The recap loads its data once and then adds sales, so reload to start from the empty stand.
    window.location.reload();
  }

  return (
    <>
      <Button variant="ghost" icon={<ArrowUturnIcon />} onClick={() => setOpen(true)}>
        Reset demo
      </Button>
      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="Reset the demo stand?">
        <p className="text-body text-ink-2">
          This brings back the sample lemonade stand and deletes every sale in the recap. Payments already made in
          the PayPal Sandbox aren&rsquo;t affected.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="tinted" onClick={() => setOpen(false)} disabled={busy !== null}>
            Keep sales
          </Button>
          <Button variant="destructive" loading={busy === "reset"} disabled={busy === "stickers"} onClick={reset}>
            Reset demo
          </Button>
        </div>
        <div className="mt-6 border-t border-hairline pt-5">
          <h3 className="text-headline">Or fill it with a sticker shop</h3>
          <p className="mt-1 text-subhead text-ink-2">{STICKER_DEMO_TEXT}</p>
          {error ? (
            <p role="alert" className="mt-3 text-subhead text-berry">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end">
            <Button variant="tinted" icon={<SparklesIcon />} loading={busy === "stickers"} disabled={busy === "reset"} onClick={stickers}>
              Load sticker shop
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
