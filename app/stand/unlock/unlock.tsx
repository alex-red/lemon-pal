"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ExclamationIcon, LemonIcon, Pill, TextField } from "@/components/kit";

export function Unlock({ next, configured }: { next: string; configured: boolean }) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    }).catch(() => null);
    if (res?.ok) return router.replace(next);
    setBusy(false);
    setError((await res?.json().catch(() => null))?.error ?? "Couldn’t check the passcode. Try again.");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center-safe gap-8 px-5 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-16 place-items-center rounded-[20px] bg-lemon text-[2.25rem] text-[oklch(0.23_0.03_85)] shadow-card">
          <LemonIcon />
        </span>
        <h1 className="font-display text-large-title font-semibold">Seller sign-in</h1>
        <p className="text-body text-ink-2 text-balance">Your register, store settings and orders are behind your passcode.</p>
      </header>

      {configured ? (
        <Card className="p-6">
          <form onSubmit={submit} className="flex flex-col gap-5">
            <TextField
              label="Passcode"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              error={error ?? undefined}
            />
            <Button type="submit" variant="filled" size="lg" loading={busy} disabled={!passcode}>
              Sign in
            </Button>
          </form>
        </Card>
      ) : (
        <div role="alert" className="flex flex-col items-center gap-3 text-center">
          <Pill tone="berry" icon={<ExclamationIcon />}>
            Not set up
          </Pill>
          <p className="text-body text-ink-2">
            Set <code className="font-mono text-footnote">SELLER_PASSCODE</code> on the server, then reload this page.
          </p>
        </div>
      )}
    </main>
  );
}
