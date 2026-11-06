"use client";

import { useMemo, useState } from "react";
import {
  AmountChips,
  DonationPoster,
  AIGlow,
  Button,
  GroupedList,
  LinkIcon,
  ListRow,
  CameraIcon,
  ChartIcon,
  ConfidencePill,
  ItemTile,
  LemonQR,
  Pill,
  Spinner,
  CheckIcon,
  ExclamationIcon,
  Money,
  PaidMoment,
  QrCodeIcon,
  SaleStatusPill,
  SegmentedControl,
  Sheet,
  Stepper,
  Switch,
  TextArea,
  TextField,
  Toolbar,
  useReveal,
  ArrowUturnIcon,
  LemonIcon,
  MoreBelow,
  ShimmerText,
  SparklesIcon,
} from "@/components/kit";
import { dealDiscount, dealLabel, type Deal } from "@/lib/deals";
import { playDing, unlockDing } from "@/lib/ding";

// Sample items for the kit only. The real register prices sales from the stored catalog on the server.
const sampleItems: { id: string; name: string; priceCents: number; emoji: string; image?: string; deal?: Deal; soldOut?: boolean }[] = [
  // A photo thumbnail, as the setup screen crops from a display photo. It takes the emoji's place.
  { id: "lemonade", name: "Lemonade", priceCents: 250, emoji: "🍋", image: "/demo/lemons-thumb.jpg" },
  { id: "sleepy-cat", name: "Sleepy Cat", priceCents: 400, emoji: "🐱", image: "/demo/stickers/sleepy-cat.webp" },
  { id: "iced-tea", name: "Iced tea", priceCents: 200, emoji: "🧊" },
  { id: "cookie", name: "Cookie", priceCents: 150, emoji: "🍪", deal: { quantity: 2, priceCents: 250 } },
  // Sold out: greyed, labelled, and not tappable.
  { id: "brownie", name: "Brownie", priceCents: 225, emoji: "🍫", soldOut: true },
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
        <TextArea
          label="Price list"
          rows={3}
          placeholder={"Lemonade $2\nCookie $1.50"}
          hint="Paste or type a few lines. Lemon Pal reads them like a sign."
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
    () =>
      sampleItems.reduce((sum, item) => {
        const quantity = cart[item.id] ?? 0;
        return sum + item.priceCents * quantity - dealDiscount(item.priceCents, quantity, item.deal);
      }, 0),
    [cart],
  );
  const count = Object.values(cart).reduce((a, b) => a + b, 0);

  function bump(id: string, by: number) {
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + by) }));
  }

  function charge() {
    unlockDing();
    setQr("https://example.com/pay/kit-demo");
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
              deal={item.deal ? dealLabel(item.deal, currency) : undefined}
              image={item.image}
              priceCents={item.priceCents}
              currency={currency}
              soldOut={item.soldOut}
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
              <Money cents={total} currency={currency} size="title" rolling className="self-start" />
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
            <PaidMoment
              cents={total}
              currency={currency}
              caption="The ding just played on the stand."
              firstSaleSeconds={52}
            />
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
                <LemonQR value={qr} label="Sample QR code" className="size-60" />
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

type ScanResult = "checking" | "reads" | "fails" | "unsupported";

/** Draws a rendered code to a canvas and decodes it with the browser's own QR reader, where it has one. */
async function scanSvg(svg: SVGSVGElement, expected: string, px: number): Promise<ScanResult> {
  if (!("BarcodeDetector" in window)) return "unsupported";
  const markup = new XMLSerializer().serializeToString(svg);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  canvas.getContext("2d")!.drawImage(image, 0, 0, px, px);
  type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
  const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  const found = await new Ctor({ formats: ["qr_code"] }).detect(canvas);
  return found.some((code) => code.rawValue === expected) ? "reads" : "fails";
}

const SAMPLE_PAY_URL = "https://lemonpal.example/pay/3f9c2a71-5b8e-4d0c-9a6f-1e2d3c4b5a60";

/** The lemon code next to the plain fallback, each with a decode check at a few sizes. */
export function QrDemo() {
  const [results, setResults] = useState<Record<string, ScanResult>>({});

  async function check() {
    const next: Record<string, ScanResult> = {};
    for (const id of ["art", "badge"]) {
      const svg = document.querySelector<SVGSVGElement>(`[data-qr-demo="${id}"] svg`);
      if (!svg) continue;
      setResults((r) => ({ ...r, [id]: "checking" }));
      // Small renders stand in for a phone held further away.
      const sizes = await Promise.all([400, 240, 160].map((px) => scanSvg(svg, SAMPLE_PAY_URL, px)));
      next[id] = sizes.includes("unsupported") ? "unsupported" : sizes.every((r) => r === "reads") ? "reads" : "fails";
      setResults((r) => ({ ...r, [id]: next[id] }));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-6 sm:grid-cols-2">
        {[
          { id: "art", title: "Lemon art", note: "Pal is imprinted into the modules. Used on the register.", art: true },
          { id: "badge", title: "Plain with badge", note: "The fallback if a phone struggles with the art.", art: false },
        ].map((v) => (
          <figure key={v.id} className="flex flex-col items-center gap-3 text-center">
            <div data-qr-demo={v.id} className="rounded-[30px] bg-lemon p-3 shadow-float">
              <LemonQR value={SAMPLE_PAY_URL} label={`${v.title} sample QR code`} art={v.art} className="size-60" />
            </div>
            <figcaption className="flex flex-col items-center gap-1.5">
              <span className="text-headline">{v.title}</span>
              <span className="text-subhead text-ink-2">{v.note}</span>
              <ScanPill result={results[v.id]} />
            </figcaption>
          </figure>
        ))}
      </div>
      <Button variant="tinted" icon={<QrCodeIcon />} className="self-center" onClick={check}>
        Check both codes scan
      </Button>
    </div>
  );
}

function ScanPill({ result }: { result: ScanResult | undefined }) {
  if (!result) return null;
  if (result === "checking") return <Pill tone="neutral" icon={<Spinner />}>Checking…</Pill>;
  if (result === "reads") return <Pill tone="leaf" icon={<CheckIcon />}>Scans at 3 sizes</Pill>;
  if (result === "fails") return <Pill tone="berry" icon={<ExclamationIcon />}>Didn’t scan</Pill>;
  return <Pill tone="neutral">This browser can’t check</Pill>;
}

const curves = [
  { token: "--ease-spring", ms: 600, use: "Touch release, sheets" },
  { token: "--ease-bounce", ms: 700, use: "Celebrations only" },
  { token: "--ease-smooth", ms: 650, use: "Layout, height, long moves" },
  { token: "--ease-snappy", ms: 600, use: "Pills, toggles, icon swaps" },
  { token: "--ease-glide", ms: 400, use: "Fades and color" },
];

export function MotionDemo() {
  const [moved, setMoved] = useState(false);
  const [thinking, setThinking] = useState(true);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-5 rounded-card bg-surface p-6 shadow-card ring-[0.5px] ring-hairline">
        <div className="flex items-center justify-between gap-4">
          <Label>Springs</Label>
          <Button variant="tinted" onClick={() => setMoved((m) => !m)}>
            Play
          </Button>
        </div>
        <ul className="flex flex-col gap-4">
          {curves.map((curve) => (
            <li key={curve.token} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <code className="font-mono text-footnote">{curve.token}</code>
                <span className="text-footnote text-ink-2">{curve.use}</span>
              </div>
              <div className="h-8 rounded-full bg-fill p-1 [container-type:inline-size]">
                <span
                  aria-hidden
                  className="block size-6 rounded-full bg-lemon shadow-card"
                  style={{
                    transform: moved ? "translateX(calc(100cqw - 1.5rem))" : "none",
                    transition: `transform ${curve.ms}ms var(${curve.token})`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-5 rounded-card bg-surface p-6 shadow-card ring-[0.5px] ring-hairline">
        <div className="flex items-center justify-between gap-4">
          <Label>AI glow</Label>
          <Switch label="Thinking" checked={thinking} onChange={setThinking} />
        </div>
        <AIGlow active={thinking} className="m-1">
          <div className="flex flex-col gap-3 rounded-card bg-canvas-raised p-5 ring-[0.5px] ring-hairline">
            <p aria-live="polite" className="flex items-center gap-2 text-headline">
              <SparklesIcon aria-hidden className={thinking ? "animate-breathe text-[1.2rem] text-peel" : "text-[1.2rem] text-leaf"} />
              {thinking ? <ShimmerText>Reading your sign…</ShimmerText> : "Found 6 items"}
            </p>
            <p className="text-subhead text-ink-2">
              The glow travels around whatever is being read and fades when the answer arrives. Pair it with words that
              say what&rsquo;s happening. With Reduce Motion it breathes in place instead.
            </p>
          </div>
        </AIGlow>
      </div>
    </div>
  );
}

const revealRows = [
  ...sampleItems,
  { id: "muffin", name: "Blueberry muffin", priceCents: 275, emoji: "🫐" },
  { id: "popcorn", name: "Popcorn", priceCents: 150, emoji: "🍿" },
  { id: "water", name: "Water", priceCents: 100, emoji: "💧" },
  { id: "melon", name: "Watermelon slice", priceCents: 125, emoji: "🍉" },
  { id: "pretzel", name: "Pretzel", priceCents: 200, emoji: "🥨" },
  { id: "cupcake", name: "Cupcake", priceCents: 250, emoji: "🧁" },
];

export function RevealDemo() {
  const [shown, setShown] = useState(false);
  const { ref, waiting, showNext } = useReveal<HTMLUListElement>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="tinted" icon={<SparklesIcon />} onClick={() => setShown((s) => !s)}>
          {shown ? "Clear results" : "Show 12 results"}
        </Button>
        <span className="text-subhead text-ink-2">Rows settle in as you reach them. The berry ring marks one to check.</span>
      </div>
      {shown ? (
        <ul ref={ref} className="grid gap-3 sm:grid-cols-2">
          {revealRows.map((item, i) => (
            <li key={item.id}>
              <div
                className={`${i === 4 ? "attention " : ""}flex items-center gap-3 rounded-card bg-surface p-4 shadow-card ring-[0.5px] ring-hairline`}
              >
                <span aria-hidden className="text-title3">
                  {item.emoji}
                </span>
                <span className="flex-1 text-body">{item.name}</span>
                {i === 4 ? <ConfidencePill confidence="low" /> : null}
                <Money cents={item.priceCents} currency="USD" />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <MoreBelow count={waiting} one="result" many="results" onClick={showNext} />
    </div>
  );
}

/** A choice made in place: ListRow with onClick is a button, and `current` checks the chosen row. The stand switcher uses it. */
export function ChoiceListDemo() {
  const [picked, setPicked] = useState("market");
  return (
    <GroupedList header="Pick a stand" footer="Rows with onClick are buttons. The chosen one carries a check and aria-current.">
      <ListRow icon={<QrCodeIcon />} iconTone="ink" title="Saturday Market" subtitle="Register at events" current={picked === "market"} onClick={() => setPicked("market")} />
      <ListRow icon={<LinkIcon />} iconTone="pool" title="Lemon Pal Shop" subtitle="Online store and orders" current={picked === "shop"} onClick={() => setPicked("shop")} />
    </GroupedList>
  );
}

/** A donation poster with live amount chips, as the donor page and display screen use them. */
export function DonationDemo() {
  const [amount, setAmount] = useState<number | "other" | null>(1000);
  return (
    <div className="flex flex-col gap-6">
      <DonationPoster
        title="Elm Street Shelter"
        intro="Every gift buys food and blankets for the animals this winter."
        accent="berry"
        caption="Scan to donate with PayPal"
        goal={{ raisedCents: 32_500, goalCents: 50_000, currency: "USD" }}
        code={<LemonQR value="https://example.com/elm-street" label="Sample donation code" className="size-40" />}
      />
      <AmountChips label="Sample amounts" amounts={[500, 1000, 2000]} other currency="USD" value={amount} onChange={setAmount} />
    </div>
  );
}
