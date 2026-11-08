"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Button,
  ChartIcon,
  DonationPoster,
  HeartIcon,
  LemonQR,
  Money,
  PaidMoment,
  PencilIcon,
  PrinterIcon,
  QuoteIcon,
  SaleStatusPill,
  Sheet,
  SparklesIcon,
  TextField,
  Toolbar,
  XmarkIcon,
} from "@/components/kit";
import { playDing, unlockDing } from "@/lib/ding";
import type { DonationFeed, DonationFeedItem } from "@/lib/donation-sales";
import { MAX_GIFT_CENTS, MIN_GIFT_CENTS } from "@/lib/donations";
import { currencyMark, formatMoney, parseCents } from "@/lib/money";
import type { PublicSale } from "@/lib/sales";
import { standApi } from "@/lib/stands";
import type { StorefrontAccent } from "@/lib/types";

type Props = {
  standId: string;
  switcher: ReactNode;
  /** Opens Pal, the stand assistant. */
  assistant?: ReactNode;
  currency: string;
  /** The donation page the poster's code opens. */
  pageUrl: string;
  /** Origin for a one-off gift's pay code. */
  payOrigin: string;
  title: string;
  intro: string;
  bannerUrl: string | null;
  accent: StorefrontAccent;
  open: boolean;
  buttonLabel: string;
  showNotes: boolean;
  /** A demo account, which can add made-up gifts to show the poster reacting. */
  demoAccount: boolean;
};

/** How often the poster checks for new gifts. */
const POLL_MS = 4000;

/**
 * The donation stand's poster, full size: the seller's photo, title and message around one code that never changes.
 * New gifts chime and pop up with the donor's first name and note. The seller can also type an amount for someone in
 * front of them, which shows a code for just that gift, or print the poster.
 */
export function DonationDisplay({ standId, switcher, assistant, currency, pageUrl, payOrigin, title, intro, bannerUrl, accent, open, buttonLabel, showNotes, demoAccount }: Props) {
  const [feed, setFeed] = useState<DonationFeed | null>(null);
  const [fresh, setFresh] = useState<DonationFeedItem | null>(null);
  const [sound, setSound] = useState(false);
  const [typing, setTyping] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const checkNow = useRef<() => Promise<void>>(async () => {});
  const [simulating, setSimulating] = useState(false);

  // iOS only plays sound after a tap, so the first tap anywhere turns the chime on.
  useEffect(() => {
    const enable = () => {
      unlockDing();
      setSound(true);
    };
    window.addEventListener("pointerdown", enable, { once: true });
    return () => window.removeEventListener("pointerdown", enable);
  }, []);

  useEffect(() => {
    let live = true;
    let hide: ReturnType<typeof setTimeout> | undefined;
    // The poll and a Simulate tap can overlap. Only the newest request's answer counts, so an older one landing late
    // can't roll the total back or swallow a new gift.
    let latest = 0;
    async function check() {
      const seq = ++latest;
      const res = await fetch(standApi("/api/stand/donations", standId), { cache: "no-store" }).catch(() => null);
      if (!res?.ok || !live) return;
      const next = (await res.json()) as DonationFeed;
      if (seq !== latest) return;
      setFeed(next);
      // The first check only sets the baseline: gifts from before the poster opened aren't news.
      if (seen.current) {
        const arrived = next.recent.filter((gift) => !seen.current!.has(gift.id));
        if (arrived.length) {
          playDing();
          setFresh(arrived[0]);
          clearTimeout(hide);
          hide = setTimeout(() => setFresh(null), 8000);
        }
      }
      seen.current = new Set(next.recent.map((gift) => gift.id));
    }
    checkNow.current = check;
    void check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
      clearTimeout(hide);
    };
  }, [standId]);

  // A made-up gift from a demo donor, picked up straight away so the chime and pop-up follow the tap.
  async function simulate() {
    setSimulating(true);
    await fetch(standApi("/api/stand/donations/simulate", standId), { method: "POST" }).catch(() => null);
    await checkNow.current();
    setSimulating(false);
  }

  const verb = buttonLabel.trim() || "Donate";
  const notes = showNotes ? (feed?.recent.filter((gift) => gift.note && !gift.noteHidden).slice(0, 3) ?? []) : [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 short:gap-3 short:pt-3 print:max-w-none print:p-0">
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          {switcher}
          <p className="flex items-center gap-1.5 text-footnote font-semibold text-ink-2">
            <HeartIcon className="text-[1.1rem] text-berry" />
            {feed ? (
              <>
                <Money cents={feed.raisedCents} currency={currency} size="inline" className="text-ink" /> from {feed.count}{" "}
                {feed.count === 1 ? "gift" : "gifts"}
              </>
            ) : (
              "Donation display"
            )}
            {!sound ? <span className="text-ink-3"> · Tap anywhere to turn on the chime</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {assistant}
          <Toolbar aria-label="Donation stand">
            <Button variant="ghost" icon={<HeartIcon />} onClick={() => setTyping(true)}>
              Enter amount
            </Button>
            <Button variant="ghost" icon={<PrinterIcon />} onClick={() => window.print()} className="max-[30rem]:hidden">
              Print
            </Button>
            <Link href="/stand/jar/edit" transitionTypes={["nav-back"]} className={toolbarLink}>
              <PencilIcon /> Edit
            </Link>
            <Link href="/stand/recap" transitionTypes={["nav-forward"]} className={toolbarLink}>
              <ChartIcon /> Recap
            </Link>
          </Toolbar>
        </div>
      </header>

      <div className="flex flex-1 flex-col justify-center-safe">
        <DonationPoster
          className="print:shadow-none print:ring-0"
          title={title}
          intro={intro}
          bannerUrl={bannerUrl}
          accent={accent}
          closed={!open}
          caption={`Scan to ${verb.toLowerCase()} with PayPal`}
          goal={feed?.goalCents ? { raisedCents: feed.raisedCents, goalCents: feed.goalCents, currency } : null}
          code={
            <LemonQR
              value={pageUrl}
              label={`Scan to ${verb.toLowerCase()} to ${title}`}
              art
              // As big as fits beside or below the message without scrolling, and never too small to scan from a step away.
              className="size-[min(22rem,70vw,max(11rem,calc(100dvh_-_20rem)))] short:size-[min(20rem,calc(100dvh_-_8rem))] print:size-[9cm]"
            />
          }
        >
          {notes.length ? (
            <ul aria-label="Recent notes" className="flex flex-col gap-2 print:hidden">
              {notes.map((gift) => (
                <li key={gift.id} className="flex items-start gap-2.5 rounded-field bg-fill px-4 py-3 text-subhead">
                  <QuoteIcon aria-hidden className="mt-0.5 shrink-0 text-[1.1em] text-peel" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {gift.note}
                    {gift.from ? <span className="text-ink-2"> — {gift.from}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </DonationPoster>
      </div>

      {demoAccount ? (
        <div className="flex justify-center print:hidden">
          <Button variant="plain" icon={<SparklesIcon />} loading={simulating} onClick={simulate}>
            Simulate a gift
          </Button>
        </div>
      ) : null}

      {fresh ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] print:hidden">
          <div role="status" className="glass flex max-w-lg animate-pop items-center gap-3 rounded-[26px] px-5 py-3">
            <HeartIcon aria-hidden className="shrink-0 text-title2 text-berry" />
            <p className="min-w-0 text-callout">
              <span className="font-semibold">
                <Money cents={fresh.amountCents} currency={currency} size="inline" />
                {fresh.from ? ` from ${fresh.from}` : " received"}
              </span>
              {showNotes && fresh.note && !fresh.noteHidden ? <span className="block text-ink-2 [overflow-wrap:anywhere]">“{fresh.note}”</span> : null}
            </p>
          </div>
        </div>
      ) : null}

      {typing ? <TypedGift standId={standId} currency={currency} payOrigin={payOrigin} onClose={() => setTyping(false)} /> : null}
    </main>
  );
}

/**
 * The seller types an amount for someone at the stand, and the sheet shows a code for just that gift, like the
 * register does. It closes on its own a moment after the gift is paid.
 */
function TypedGift({ standId, currency, payOrigin, onClose }: { standId: string; currency: string; payOrigin: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const [sale, setSale] = useState<PublicSale | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = parseCents(text);
  const valid = cents !== null && !Number.isNaN(cents) && cents >= MIN_GIFT_CENTS && cents <= MAX_GIFT_CENTS;

  useEffect(() => {
    if (!sale || sale.status !== "open") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/sales/${sale.id}`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const next = (await res.json()) as PublicSale;
      if (next.status !== "open") setSale(next);
    }, 1000);
    return () => clearInterval(timer);
  }, [sale]);

  async function start(event: FormEvent) {
    event.preventDefault();
    unlockDing();
    if (!valid) return setError(`Enter an amount from ${formatMoney(MIN_GIFT_CENTS, currency)} to ${formatMoney(MAX_GIFT_CENTS, currency)}.`);
    setBusy(true);
    setError(null);
    const res = await fetch(standApi("/api/stand/donations", standId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: cents }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(json?.error ?? "Couldn’t make a code. Check the connection and try again.");
    setSale(json as PublicSale);
  }

  // Cancel on the server so the code can't be paid later. A gift that was paid meanwhile stays paid.
  async function close() {
    if (sale?.status === "open") {
      const res = await fetch(`/api/stand/sales/${sale.id}/cancel`, { method: "POST" }).catch(() => null);
      const next = res?.ok ? ((await res.json()) as PublicSale) : null;
      if (next?.status === "paid") return setSale(next);
    }
    onClose();
  }

  return (
    <Sheet open onClose={() => void close()} title={sale ? "Scan to give" : "Enter an amount"}>
      {sale?.status === "paid" ? (
        <div className="flex flex-col items-center gap-6">
          <PaidMoment cents={sale.totalCents} currency={sale.currency} caption="Thank you!" />
          <Button variant="filled" size="lg" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : sale ? (
        <div className="flex flex-col items-center gap-5 text-center">
          <SaleStatusPill status={sale.status} />
          <Money cents={sale.totalCents} currency={sale.currency} size="hero" />
          {sale.status === "open" ? (
            <div className="rounded-[34px] bg-lemon p-4 shadow-float">
              <LemonQR value={`${payOrigin}/pay/${sale.id}`} label="Scan to pay with PayPal" art className="size-[min(16rem,60vw,max(10rem,calc(100dvh_-_24rem)))]" />
            </div>
          ) : (
            <p className="text-body text-ink-2">This code was canceled.</p>
          )}
          <Button variant="destructive" icon={<XmarkIcon />} onClick={() => void close()}>
            {sale.status === "open" ? "Cancel" : "Close"}
          </Button>
        </div>
      ) : (
        <form onSubmit={start} className="flex flex-col gap-5">
          <TextField
            label="Amount"
            prefix={currencyMark(currency)}
            inputMode="decimal"
            enterKeyHint="go"
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            error={error ?? undefined}
            hint="For someone who wants to give a set amount. They scan the code and pay with PayPal."
          />
          <Button type="submit" variant="filled" size="lg" icon={<HeartIcon />} loading={busy} disabled={!valid && !busy}>
            {valid ? `Show code for ${formatMoney(cents!, currency)}` : "Show code"}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

const toolbarLink =
  "pressable focus-ring inline-flex h-11 items-center gap-2 rounded-full px-5 text-callout font-semibold text-ink hover:bg-fill-2 [&_svg]:text-[1.15em] max-[24rem]:px-3.5 max-[24rem]:[&_svg]:hidden";
