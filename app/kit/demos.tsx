"use client";

import QRCode from "qrcode";
import { useMemo, useState } from "react";
import {
  Button,
  CameraIcon,
  ChartIcon,
  ConfidencePill,
  ItemTile,
  Money,
  PaidMoment,
  QrCodeIcon,
  SaleStatusPill,
  SegmentedControl,
  Sheet,
  Stepper,
  Switch,
  TextField,
  Toolbar,
  ArrowUturnIcon,
  LemonIcon,
} from "@/components/kit";
import { playDing, unlockDing } from "@/lib/ding";

// Sample items for the kit only. The real register prices sales from the stored catalog on the server.
const sampleItems = [
  { id: "lemonade", name: "Lemonade", priceCents: 250, emoji: "🍋" },
  { id: "pink", name: "Pink lemonade", priceCents: 300, emoji: "🌸" },
  { id: "iced-tea", name: "Iced tea", priceCents: 200, emoji: "🧊" },
  { id: "cookie", name: "Cookie", priceCents: 150, emoji: "🍪" },
  { id: "brownie", name: "Brownie", priceCents: 225, emoji: "🍫" },
  { id: "tip", name: "Tip jar", priceCents: 100, emoji: "🫙" },
];

export function ControlsDemo() {
  const [range, setRange] = useState<"today" | "week" | "all">("today");
  const [ding, setDing] = useState(true);
  const [cups, setCups] = useState(2);
  const [price, setPrice] = useState("2.5O");
  const [loading, setLoading] = useState(false);
  const priceError = /^\d{1,4}(\.\d{1,2})?$/.test(price.trim()) ? undefined : "Use numbers only, like 2.50";

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-6 rounded-card bg-surface p-6 shadow-card ring-[0.5px] ring-hairline">
        <Label>Segmented control</Label>
        <SegmentedControl
          label="Recap range"
          value={range}
          onChange={setRange}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "This week" },
            { value: "all", label: "All time" },
          ]}
        />
        <Label>Switch</Label>
        <div className="flex items-center justify-between gap-4">
          <span className="text-body">Ding when paid</span>
          <Switch label="Ding when paid" checked={ding} onChange={setDing} />
        </div>
        <Label>Stepper</Label>
        <div className="flex items-center justify-between gap-4">
          <span className="text-body">Lemonade</span>
          <Stepper label="Lemonade" value={cups} onChange={setCups} />
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-card bg-surface p-6 shadow-card ring-[0.5px] ring-hairline">
        <Label>Text fields</Label>
        <TextField label="Item name" defaultValue="Pink lemonade" autoComplete="off" />
        <TextField
          label="Price"
          prefix="$"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={priceError}
          hint="What the sign says, before any tip."
        />
        <div className="flex items-center gap-3">
          <ConfidencePill confidence="low" />
          <span className="text-footnote text-ink-2">The reader wasn&rsquo;t sure. Try fixing the letter O.</span>
        </div>
        <Button
          variant="filled"
          size="lg"
          loading={loading}
          onClick={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1600);
          }}
        >
          {loading ? "Saving…" : "Save item"}
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="-mb-3 text-footnote font-semibold uppercase tracking-[0.06em] text-ink-3">{children}</p>;
}

type Phase = "ringing" | "waiting" | "paid";

/** The whole register flow on one iPad-shaped canvas: tap tiles, charge, show the code, celebrate. */
export function RegisterDemo() {
  const [cart, setCart] = useState<Record<string, number>>({ lemonade: 2, cookie: 1 });
  const [phase, setPhase] = useState<Phase>("ringing");
  const [qr, setQr] = useState<string | null>(null);
  const currency = "USD";

  const total = useMemo(
    () => sampleItems.reduce((sum, item) => sum + item.priceCents * (cart[item.id] ?? 0), 0),
    [cart],
  );
  const count = Object.values(cart).reduce((a, b) => a + b, 0);

  function bump(id: string, by: number) {
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + by) }));
  }

  async function charge() {
    unlockDing();
    setQr(await QRCode.toDataURL("https://example.com/pay/kit-demo", { margin: 1, width: 360 }));
    setPhase("waiting");
  }

  function finish() {
    setCart({});
    setPhase("ringing");
  }

  return (
    <div className="rounded-[46px] bg-[oklch(0.2_0.01_85)] p-3 shadow-lift ring-1 ring-black/20 dark:bg-black">
      <div className="relative isolate overflow-hidden rounded-[34px] bg-canvas">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_0%_0%,var(--mesh-a),transparent_70%),radial-gradient(60%_60%_at_100%_100%,var(--mesh-b),transparent_70%)]"
        />
        <header className="flex flex-wrap items-center justify-between gap-4 px-7 pt-7">
          <div>
            <p className="flex items-center gap-1.5 text-footnote font-semibold text-ink-2">
              <LemonIcon className="text-[1.1rem]" /> Saturday market
            </p>
            <h3 className="font-display text-large-title font-semibold">Sunny Side Stand</h3>
          </div>
          <Toolbar aria-label="Stand">
            <Button variant="ghost" size="md" icon={<CameraIcon />}>
              Sign
            </Button>
            <Button variant="ghost" size="md" icon={<ChartIcon />}>
              Recap
            </Button>
          </Toolbar>
        </header>

        <div className="grid grid-cols-2 gap-4 px-7 pt-6 pb-36 lg:grid-cols-3">
          {sampleItems.map((item) => (
            <ItemTile
              key={item.id}
              name={item.name}
              emoji={item.emoji}
              priceCents={item.priceCents}
              currency={currency}
              count={cart[item.id] ?? 0}
              onAdd={() => bump(item.id, 1)}
              onRemove={() => bump(item.id, -1)}
            />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-6">
          <div className="glass pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-full p-2 pl-3">
            <Button
              variant="tinted"
              size="lg"
              iconOnly
              aria-label="Clear sale"
              icon={<ArrowUturnIcon />}
              disabled={count === 0}
              onClick={() => setCart({})}
            />
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-footnote text-ink-2">
                {count === 0 ? "Tap an item to start" : `${count} ${count === 1 ? "item" : "items"}`}
              </span>
              <Money cents={total} currency={currency} size="title" />
            </div>
            <Button variant="filled" size="xl" icon={<QrCodeIcon />} disabled={total === 0} onClick={() => void charge()}>
              Charge
            </Button>
          </div>
        </div>
      </div>

      <Sheet
        open={phase !== "ringing"}
        onClose={() => (phase === "paid" ? finish() : setPhase("ringing"))}
        title={phase === "paid" ? "Sale complete" : "Scan to pay"}
      >
        {phase === "paid" ? (
          <div className="flex flex-col items-center gap-7 pt-2">
            <PaidMoment cents={total} currency={currency} caption="The ding just played on the stand." />
            <Button variant="filled" size="lg" className="w-full" onClick={finish}>
              Next customer
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <SaleStatusPill status="open" />
            <Money cents={total} currency={currency} size="hero" />
            {qr ? (
              <div className="rounded-[30px] bg-lemon p-3 shadow-float">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the qrcode package */}
                <img src={qr} alt="Sample QR code" width={240} height={240} className="rounded-[18px] bg-white" />
              </div>
            ) : null}
            <p className="text-center text-subhead text-ink-2">Point your phone camera here. You&rsquo;ll pay with PayPal.</p>
            <div className="flex w-full gap-3">
              <Button variant="destructive" size="lg" className="flex-1" onClick={() => setPhase("ringing")}>
                Cancel sale
              </Button>
              <Button
                variant="lemon"
                size="lg"
                className="flex-1"
                onClick={() => {
                  playDing();
                  setPhase("paid");
                }}
              >
                Simulate paid
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
