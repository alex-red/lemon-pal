"use client";

import { useState } from "react";
import { ArrowUturnIcon, Button, Sheet } from "@/components/kit";
import { standApi } from "@/lib/stands";
import type { StandKind } from "@/lib/types";

/** Lets a judge start the demo over: the stand's sample catalog comes back and its test sales are deleted. */
export function ResetDemo({ standId, kind }: { standId: string; kind: StandKind }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    await fetch(standApi("/api/stand?sales=clear", standId), { method: "DELETE" });
    // The recap loads its data once and then adds sales, so reload to start from the empty stand.
    window.location.reload();
  }

  return (
    <>
      <Button variant="ghost" icon={<ArrowUturnIcon />} onClick={() => setOpen(true)}>
        Reset demo
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Reset this stand?">
        <p className="text-body text-ink-2">
          This brings back the sample {kind === "online" ? "shop" : "lemonade stand"} and deletes every sale on this
          stand. Your other stands aren&rsquo;t touched, and payments already made in the PayPal Sandbox aren&rsquo;t
          affected.
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
