"use client";

import { useState } from "react";
import { ArrowUturnIcon, Button, Sheet } from "@/components/kit";

/** Lets a judge start the demo over: the sample catalog comes back and test sales are deleted. */
export function ResetDemo() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    await fetch("/api/stand?sales=clear", { method: "DELETE" });
    // The recap loads its data once and then adds sales, so reload to start from the empty stand.
    window.location.reload();
  }

  return (
    <>
      <Button variant="ghost" icon={<ArrowUturnIcon />} onClick={() => setOpen(true)}>
        Reset demo
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Reset the demo stand?">
        <p className="text-body text-ink-2">
          This brings back the sample lemonade stand and deletes every sale in the recap. Payments already made in
          the PayPal Sandbox aren&rsquo;t affected.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="tinted" onClick={() => setOpen(false)} disabled={busy}>
            Keep sales
          </Button>
          <Button variant="destructive" loading={busy} onClick={reset}>
            Reset demo
          </Button>
        </div>
      </Sheet>
    </>
  );
}
