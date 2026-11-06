"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  ChevronRightIcon,
  ExclamationIcon,
  GroupedList,
  LemonIcon,
  ListRow,
  Pill,
  SparklesIcon,
  TextField,
  WalletIcon,
} from "@/components/kit";
import { forgetDemoAccount, saveDemoAccount, savedDemoAccounts, type SavedDemoAccount } from "../demo-accounts";

/**
 * How a seller gets in. Log in with PayPal gives them their own stands. A demo account, behind the passcode, is for
 * judges and trying things out: each person makes their own, loaded with a sticker shop, and this browser keeps it so
 * they can come back to it.
 */
export function Unlock({
  next,
  demo,
  passcodeRemembered,
  paypalLogin,
  error: arrivedWith,
}: {
  next: string;
  /** "open" in development without a passcode, "passcode" when one is set, "off" when the server has none. */
  demo: "open" | "passcode" | "off";
  /** This browser already gave the passcode, so making another demo account doesn't ask again. */
  passcodeRemembered: boolean;
  paypalLogin: boolean;
  /** Why the seller is back here, such as a canceled PayPal sign-in. */
  error: string | null;
}) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedDemoAccount[]>([]);
  const askPasscode = demo === "passcode" && !passcodeRemembered;

  // localStorage only exists in the browser, so the saved accounts appear once the page is running there.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSaved(savedDemoAccounts()), []);

  async function createDemo(event: React.FormEvent) {
    event.preventDefault();
    setBusy("new");
    setError(null);
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: askPasscode ? passcode : undefined, tzOffsetMinutes: new Date().getTimezoneOffset() }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { account?: SavedDemoAccount; error?: string } | null;
    if (res?.ok && json?.account) {
      saveDemoAccount(json.account);
      return router.replace(next);
    }
    setBusy(null);
    setError(json?.error ?? "Couldn’t make a demo account. Try again.");
  }

  async function resume(account: SavedDemoAccount) {
    setBusy(account.id);
    setError(null);
    const res = await fetch("/api/unlock/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: account.token }),
    }).catch(() => null);
    if (res?.ok) return router.replace(next);
    const json = (await res?.json().catch(() => null)) as { error?: string; gone?: boolean } | null;
    if (json?.gone) {
      forgetDemoAccount(account.id);
      setSaved(savedDemoAccounts());
    }
    setBusy(null);
    setError(json?.error ?? "Couldn’t open that demo account. Try again.");
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
        <Card className="flex flex-col gap-5 p-6">
          <div>
            <h2 className="text-headline font-semibold">{paypalLogin ? "Or try a demo account" : "Try a demo account"}</h2>
            <p className="mt-1 text-subhead text-ink-2">
              Your own stand at events and online store, filled with a month of sticker shop sales. It stays on this
              browser for 30 days after you last use it.
            </p>
          </div>
          {saved.length > 0 ? (
            <GroupedList header="On this browser">
              {saved.map((account) => (
                <ListRow
                  key={account.id}
                  icon={<SparklesIcon />}
                  iconTone="lemon"
                  title={account.name}
                  subtitle={busy === account.id ? "Opening…" : `Made ${new Date(account.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                  trailing={<ChevronRightIcon className="text-ink-3" />}
                  onClick={() => !busy && resume(account)}
                />
              ))}
            </GroupedList>
          ) : null}
          <form onSubmit={createDemo} className="flex flex-col gap-5">
            {askPasscode ? (
              <TextField
                label="Passcode"
                type="password"
                autoComplete="current-password"
                autoFocus={!paypalLogin && saved.length === 0}
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
              variant={paypalLogin || saved.length > 0 ? "tinted" : "filled"}
              size="lg"
              icon={<SparklesIcon />}
              loading={busy === "new"}
              disabled={Boolean(busy) || (askPasscode && !passcode)}
            >
              {busy === "new" ? "Filling your shop…" : "Create new demo account"}
            </Button>
          </form>
        </Card>
      )}
    </main>
  );
}
