"use client";

import { useEffect, useState } from "react";
import {
  AiModePill,
  Button,
  Card,
  ChevronRightIcon,
  ExclamationIcon,
  GroupedList,
  LemonIcon,
  ListRow,
  SparklesIcon,
  TextField,
  WalletIcon,
} from "@/components/kit";
import { PASSCODE_NAME } from "@/lib/ai-preview";
import { forgetDemoAccount, saveDemoAccount, savedDemoAccounts, type SavedDemoAccount } from "../demo-accounts";

/**
 * How a seller gets in. Log in with PayPal gives them their own stands. A demo account is for judges and trying things
 * out: anyone can make one, loaded with a sticker shop, and this browser keeps it so they can come back to it. It runs
 * on simulated AI until this browser enters the seller passcode, which unlocks real AI.
 */
export function Unlock({
  next,
  realAi,
  aiUnlocked,
  cameForAi,
  paypalLogin,
  error: arrivedWith,
}: {
  next: string;
  /** "open" in development without a passcode, "passcode" when one is set, "off" when the server has none. */
  realAi: "open" | "passcode" | "off";
  /** This browser already gave the passcode, so it has real AI. */
  aiUnlocked: boolean;
  /** Sent here from a locked AI feature, so unlocking goes straight back to it. */
  cameForAi: boolean;
  paypalLogin: boolean;
  /** Why the seller is back here, such as a canceled PayPal sign-in. */
  error: string | null;
}) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedDemoAccount[]>([]);
  const [live, setLive] = useState(aiUnlocked);

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
      body: JSON.stringify({ tzOffsetMinutes: new Date().getTimezoneOffset() }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { account?: SavedDemoAccount; error?: string } | null;
    if (res?.ok && json?.account) {
      saveDemoAccount(json.account);
      return enter(next);
    }
    setBusy(null);
    setError(json?.error ?? "Couldn’t make a demo account. Try again.");
  }

  async function unlockAi(event: React.FormEvent) {
    event.preventDefault();
    setBusy("ai");
    setAiError(null);
    const res = await fetch("/api/unlock/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { error?: string } | null;
    setBusy(null);
    if (!res?.ok) return setAiError(json?.error ?? "Couldn’t check the passcode. Try again.");
    setPasscode("");
    setLive(true);
    if (cameForAi) enter(next);
  }

  async function resume(account: SavedDemoAccount) {
    setBusy(account.id);
    setError(null);
    const res = await fetch("/api/unlock/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: account.token }),
    }).catch(() => null);
    if (res?.ok) return enter(next);
    const json = (await res?.json().catch(() => null)) as { error?: string; gone?: boolean } | null;
    if (json?.gone) {
      forgetDemoAccount(account.id);
      setSaved(savedDemoAccounts());
    }
    setBusy(null);
    setError(json?.error ?? "Couldn’t open that demo account. Try again.");
  }

  // Real AI: the passcode form, or that this browser has it.
  const aiCard = (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-headline font-semibold">Real AI for judges</h2>
          <AiModePill live={live} />
        </div>
        {live ? (
          <p className="text-subhead text-ink-2">
            {realAi === "open"
              ? "This development server has no passcode, so every demo account uses real AI."
              : "This browser entered the seller passcode. Claude reads any sign or list, Pal answers anything you type or say, and Booth Analyst builds charts."}
          </p>
        ) : realAi === "off" ? (
          <p className="text-subhead text-ink-2">
            Real AI is off on this server. Set <code className="font-mono text-footnote">{PASSCODE_NAME}</code> to turn it on.
          </p>
        ) : (
          <p className="text-subhead text-ink-2">
            Enter the seller passcode (<code className="font-mono text-footnote">{PASSCODE_NAME}</code>) from the
            submission to use Claude: it reads your own sign photos and lists, Pal answers anything you type or say,
            and Booth Analyst builds charts. Without it, the AI is simulated: you pick from demo signs and Pal&rsquo;s
            suggested requests, and Booth Analyst is off. PayPal works either way.
          </p>
        )}
      </div>
      {live || realAi !== "passcode" ? null : (
        <form onSubmit={unlockAi} className="flex flex-col gap-5">
          <TextField
            label="Seller passcode"
            type="password"
            autoComplete="current-password"
            autoFocus={cameForAi}
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            error={aiError ?? undefined}
          />
          <Button
            type="submit"
            variant={cameForAi ? "filled" : "tinted"}
            size="lg"
            icon={<SparklesIcon />}
            loading={busy === "ai"}
            disabled={Boolean(busy) || !passcode}
          >
            Unlock real AI
          </Button>
        </form>
      )}
    </Card>
  );

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
            {live || realAi !== "passcode"
              ? null
              : " Its AI is simulated until this browser enters the seller passcode on this page, before or after you log in."}
          </p>
        </Card>
      ) : null}

      {cameForAi && !live ? aiCard : null}

      <Card className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="text-headline font-semibold">{paypalLogin ? "Or try a demo account" : "Try a demo account"}</h2>
          <p className="mt-1 text-subhead text-ink-2">
            Your own stand at events, online store and donation jar, filled with a month of sticker shop sales. It stays
            on this browser for 30 days after you last use it.
            {live ? null : " Its AI is simulated until you enter the seller passcode below."}
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
          {error ? (
            <p role="alert" className="text-footnote font-semibold text-berry">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            variant={paypalLogin || saved.length > 0 || cameForAi ? "tinted" : "filled"}
            size="lg"
            icon={<SparklesIcon />}
            loading={busy === "new"}
            disabled={Boolean(busy)}
          >
            {busy === "new" ? "Filling your shop…" : "Create new demo account"}
          </Button>
        </form>
      </Card>

      {cameForAi && !live ? null : aiCard}
    </main>
  );
}

/**
 * Opens the seller's page with a full page load. Signing in changes whose pages these are, and the client router
 * still holds what it fetched while signed out: a protected page cached as a redirect back here. A soft navigation
 * would replay that redirect and leave the button spinning on this page.
 */
function enter(next: string) {
  window.location.replace(next);
}
