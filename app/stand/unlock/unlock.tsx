"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ExclamationIcon, LemonIcon, Pill, SparklesIcon, TextField, WalletIcon } from "@/components/kit";

/**
 * How a seller gets in. Log in with PayPal gives them their own stands. The demo seller, behind the passcode, is
 * for judges and trying things out: it already has a stand at events and an online shop.
 */
export function Unlock({
  next,
  demo,
  paypalLogin,
  error: arrivedWith,
}: {
  next: string;
  /** "open" in development without a passcode, "passcode" when one is set, "off" when the server has none. */
  demo: "open" | "passcode" | "off";
  paypalLogin: boolean;
  /** Why the seller is back here, such as a canceled PayPal sign-in. */
  error: string | null;
}) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function enterDemo(event: React.FormEvent) {
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
        <p className="text-body text-ink-2 text-balance">Your stands, store and orders, wherever you sell.</p>
      </header>

      {arrivedWith ? (
        <p role="alert" className="flex items-start justify-center gap-2 text-center text-subhead font-semibold text-berry">
          <ExclamationIcon className="mt-0.5 shrink-0" /> {arrivedWith}
        </p>
      ) : null}

      {paypalLogin ? (
        <Card className="flex flex-col gap-3 p-6">
          {/* A plain form, so it works before the page's script loads. The server sends the browser on to PayPal. */}
          <form method="GET" action="/api/auth/paypal">
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="filled" size="lg" icon={<WalletIcon />} className="w-full">
              Log in with PayPal
            </Button>
          </form>
          <p className="text-center text-footnote text-ink-2">
            You get your own stands, ready to set up. In this demo, payments still go to Lemon Pal&rsquo;s PayPal Sandbox
            account.
          </p>
        </Card>
      ) : null}

      {demo === "off" ? (
        paypalLogin ? null : (
          <div role="alert" className="flex flex-col items-center gap-3 text-center">
            <Pill tone="berry" icon={<ExclamationIcon />}>
              Not set up
            </Pill>
            <p className="text-body text-ink-2">
              Set <code className="font-mono text-footnote">SELLER_PASSCODE</code> on the server, then reload this page.
            </p>
          </div>
        )
      ) : (
        <Card className="p-6">
          <form onSubmit={enterDemo} className="flex flex-col gap-5">
            <div>
              <h2 className="text-headline font-semibold">{paypalLogin ? "Or try the demo seller" : "Try the demo seller"}</h2>
              <p className="mt-1 text-subhead text-ink-2">A stand at events and an online shop, ready to sell from.</p>
            </div>
            {demo === "passcode" ? (
              <TextField
                label="Passcode"
                type="password"
                autoComplete="current-password"
                autoFocus={!paypalLogin}
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                error={error ?? undefined}
              />
            ) : error ? (
              <p role="alert" className="text-footnote font-semibold text-berry">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              variant={paypalLogin ? "tinted" : "filled"}
              size="lg"
              icon={<SparklesIcon />}
              loading={busy}
              disabled={demo === "passcode" && !passcode}
            >
              Use the demo seller
            </Button>
          </form>
        </Card>
      )}
    </main>
  );
}
