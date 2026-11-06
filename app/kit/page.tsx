import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  AddressBlock,
  Button,
  CameraIcon,
  Card,
  ChartIcon,
  CheckIcon,
  ConfidencePill,
  FirstSalePill,
  CountBadge,
  FulfillmentPill,
  Glass,
  GroupedList,
  LemonIcon,
  ListRow,
  Money,
  PaidMoment,
  PalAppIcon,
  PalMascot,
  Pill,
  PlusIcon,
  QrCodeIcon,
  SaleStatusPill,
  ScrollEdge,
  SparklesIcon,
  Spinner,
  StorefrontHeader,
  WalletIcon,
  XmarkIcon,
} from "@/components/kit";
import { ControlsDemo, MotionDemo, QrDemo, RegisterDemo, RevealDemo } from "./demos";

export const metadata: Metadata = {
  title: "Citrus Glass · Lemon Pal design kit",
  description: "Tokens, components and interaction rules for Lemon Pal.",
};

const sections = [
  { id: "brand", label: "Brand & app icons" },
  { id: "principles", label: "Principles" },
  { id: "color", label: "Color" },
  { id: "type", label: "Typography" },
  { id: "materials", label: "Materials & depth" },
  { id: "controls", label: "Controls" },
  { id: "commerce", label: "Commerce" },
  { id: "register", label: "Register pattern" },
  { id: "motion", label: "Motion" },
];

const palAppearances = [
  { label: "Default", appearance: "default" },
  { label: "Dark", appearance: "dark" },
  { label: "Clear light", appearance: "clear-light", backdrop: "bg-linear-to-br from-leaf/55 to-lemon/60" },
  { label: "Clear dark", appearance: "clear-dark", backdrop: "bg-linear-to-br from-leaf/70 to-ink/90 dark:to-canvas" },
  { label: "Tinted light", appearance: "tinted-light" },
  { label: "Tinted dark", appearance: "tinted-dark" },
] as const;

const principles = [
  {
    title: "Thumb-sized targets",
    law: "Fitts's law",
    body: "Nothing tappable is smaller than 44pt. Register tiles are the biggest thing on screen because they're tapped most, in a rush, often with sticky fingers.",
  },
  {
    title: "One decision per screen",
    law: "Hick's law",
    body: "Each screen has a single filled button: Charge, Pay, Next customer. Everything else steps back to tinted or plain.",
  },
  {
    title: "Answer within 100ms",
    law: "Doherty threshold",
    body: "Every press dips and springs back at once. Network work shows a spinner in place, and payment confirmation pairs a ding with the Paid screen.",
  },
  {
    title: "Never color alone",
    law: "WCAG 1.4.1",
    body: "Status always carries an icon and a word. Paid is green, a check and the word Paid, readable for color-blind sellers and in harsh sun.",
  },
  {
    title: "Forgive the mis-tap",
    law: "Reversibility",
    body: "A minus appears on any tile with a count. Cancel sale voids the code on the server. Nothing irreversible hides behind a single tap.",
  },
  {
    title: "Defer to the setting",
    law: "Accessibility settings",
    body: "Reduce Motion turns morphs and slides into crossfades, Reduce Transparency turns glass solid, Increase Contrast darkens hairlines, and dark mode suits a night market.",
  },
];

const swatches: Array<{ token: string; name: string; note: string; text?: string }> = [
  { token: "--lemon", name: "Lemon", note: "Accent, active tiles, QR frame", text: "oklch(0.23 0.03 85)" },
  { token: "--peel", name: "Peel", note: "Tinted text and plain buttons" },
  { token: "--leaf", name: "Leaf", note: "Paid, success, on switches" },
  { token: "--pool", name: "Pool", note: "Waiting, information" },
  { token: "--berry", name: "Berry", note: "Destructive, errors" },
  { token: "--ink", name: "Ink", note: "Primary label, filled buttons" },
];

const labels = [
  { token: "--ink", name: "Label" },
  { token: "--ink-2", name: "Secondary" },
  { token: "--ink-3", name: "Tertiary" },
];

const fills = ["--fill", "--fill-2", "--fill-3", "--hairline"];

// Every motion pattern in the app. Keep in step with the Motion section of AGENTS.md.
const motionPatterns: Array<{ name: string; piece: string; body: string; where: string; reduced: string }> = [
  {
    name: "Press",
    piece: ".pressable",
    body: "Anything tappable dips under the finger and springs back.",
    where: "Every button, tile and link",
    reduced: "Doesn’t shrink",
  },
  {
    name: "Thinking",
    piece: "AIGlow · ShimmerText",
    body: "A lemon and leaf light travels around what the AI is reading, and the status words shimmer. A light band passes over a sign photo.",
    where: "Setup while reading; the recap assistant's input while Claude answers",
    reduced: "Breathes in place; the recap input’s glow holds still",
  },
  {
    name: "Results",
    piece: "useReveal · MoreBelow",
    body: "The page glides to a result once, unless you scrolled away. Rows settle in as you reach them, a pill counts the rest, and rows to check get a berry ring.",
    where: "Setup's item review",
    reduced: "Rows appear; the page jumps instead of gliding",
  },
  {
    name: "Morph",
    piece: "<ViewTransition share=\"morph\">",
    body: "An object that survives a screen change changes shape instead of being swapped: Charge grows into the code card and the total flies up to the big price.",
    where: "Register: charge, cancel, paid",
    reduced: "Crossfade",
  },
  {
    name: "Rolling total",
    piece: "Money rolling",
    body: "Each digit rolls to its new value like an odometer. New digits roll up from 0.",
    where: "The register's total bar",
    reduced: "Snaps to the value",
  },
  {
    name: "Sheet",
    piece: "Sheet",
    body: "On iPad and desktop it grows out of the button that opened it and shrinks back. On phones it rises from the bottom edge, and dragging its top down dismisses it.",
    where: "Camera, reset demo, kit register",
    reduced: "Appears and leaves in place",
  },
  {
    name: "Scroll edge",
    piece: "ScrollEdge · useScrollCompact",
    body: "Content softens as it scrolls under the top of the screen or a floating bar. The bar minimizes while you scroll down and comes back on any scroll up or pause.",
    where: "Setup, Register, this page",
    reduced: "The edge still appears; the bar stays full size",
  },
  {
    name: "Page slide",
    piece: "PageTransition",
    body: "Going deeper slides the next page in from the trailing edge; going back slides it in from the leading edge. 60px is enough to say which way you went.",
    where: "Home, Setup, Register, Recap",
    reduced: "Crossfade",
  },
  {
    name: "Celebrate",
    piece: "PaidMoment",
    body: "Pal pops up with a ripple and a wiggle, the check lands, and the register dings.",
    where: "Paid screens",
    reduced: "Appears without movement",
  },
];

const typeRamp: Array<{ name: string; className: string; sample: string; spec: string }> = [
  { name: "Price", className: "font-price text-hero font-bold", sample: "$17.50", spec: "SF Pro Rounded 80, tabular" },
  { name: "Large title", className: "font-display text-large-title font-semibold", sample: "Sunny Side Stand", spec: "Fraunces 38 / 1.08" },
  { name: "Title 1", className: "font-display text-title1 font-semibold", sample: "Scan to pay", spec: "Fraunces 28 / 1.15" },
  { name: "Title 2", className: "font-display text-title2 font-semibold", sample: "Today at the market", spec: "Fraunces 22 / 1.2" },
  { name: "Title 3", className: "text-title3 font-semibold", sample: "Pink lemonade", spec: "SF Pro 20 / 1.25" },
  { name: "Headline", className: "text-headline", sample: "Next customer", spec: "SF Pro 17 semibold" },
  { name: "Body", className: "text-body", sample: "Point your phone camera at the code.", spec: "SF Pro 17 / 1.45" },
  { name: "Subhead", className: "text-subhead text-ink-2", sample: "3 items · paid with PayPal", spec: "SF Pro 15 / 1.38" },
  { name: "Footnote", className: "text-footnote text-ink-2", sample: "Prices come from your confirmed sign.", spec: "SF Pro 13 / 1.38" },
  { name: "Mono", className: "font-mono text-footnote text-ink-2", sample: "SALE 01JD-7Q3K · 2026-11-05 14:02", spec: "SF Mono 13" },
];

export default function KitPage() {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-1 gap-8 px-4 py-6 sm:px-6 lg:py-8">
      <aside className="sticky top-8 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 lg:block">
        <Glass className="flex h-full flex-col gap-1 rounded-[30px] p-3">
          <div className="flex items-center gap-2.5 px-3 pt-3 pb-5">
            <span className="grid size-10 place-items-center rounded-[12px] bg-lemon text-[1.5rem] shadow-card">
              <LemonIcon className="text-[oklch(0.23_0.03_85)]" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-title3 font-semibold">Citrus Glass</p>
              <p className="text-footnote text-ink-2">Lemon Pal kit · 2026</p>
            </div>
          </div>
          <nav aria-label="Kit sections" className="flex flex-col gap-0.5">
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="pressable focus-ring flex h-11 items-center gap-3 rounded-[16px] px-3 text-callout font-medium text-ink hover:bg-fill-2"
              >
                <span className="w-5 text-right font-mono text-caption text-ink-3">{String(i).padStart(2, "0")}</span>
                {s.label}
              </a>
            ))}
          </nav>
          <p className="mt-auto px-3 pb-3 text-footnote text-ink-3">
            Try it in dark mode, with Reduce Motion, and with Reduce Transparency.
          </p>
        </Glass>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-24 pb-24">
        <ScrollEdge />
        <Hero />

        <Section
          id="brand"
          eyebrow="00 · Brand"
          title="Meet The Pal"
          lede="The smile is cut from the lemon, so it reads in one color at toolbar and browser-tab sizes. The Home Screen icon gives the same mark a softly lit glass tile."
        >
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <LemonIcon className="text-[2rem]" />
                <span className="font-display text-title2 font-semibold">Lemon Pal</span>
              </div>
              <p className="font-mono text-caption uppercase tracking-[0.08em] text-ink-2">Flat mark</p>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 p-5 sm:grid-cols-3 sm:gap-x-6 sm:p-7">
              {palAppearances.map(({ label, appearance, ...sample }) => (
                <li key={appearance} className="min-w-0">
                  <div className="relative isolate grid min-h-28 place-items-center overflow-hidden rounded-tile bg-fill p-4 sm:min-h-36">
                    {"backdrop" in sample ? (
                      <div aria-hidden className={`absolute inset-0 -z-10 ${sample.backdrop}`} />
                    ) : null}
                    <PalAppIcon appearance={appearance} className="size-18 drop-shadow-sm sm:size-24" />
                  </div>
                  <p className="mt-2 text-footnote font-semibold">{label}</p>
                </li>
              ))}
            </ul>
            <p className="border-t border-hairline px-5 py-4 text-footnote text-ink-2 sm:px-7">
              The installed web app uses Default. The other finishes preview the mark in different materials.
            </p>
          </Card>
          <Card className="mt-6 flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
            <PalMascot className="size-28 shrink-0 drop-shadow-lg" />
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-title2 font-semibold">Pal, the mascot</h3>
              <p className="text-subhead text-ink-2">
                The full-color character for celebrations. It pops up on the Paid screen. It&rsquo;s decorative, so always put words next to it.
              </p>
            </div>
          </Card>
        </Section>

        <Section id="principles" eyebrow="01 · Principles" title="Built for a busy stand">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {principles.map((p, i) => (
              <Card key={p.title} className="flex animate-rise flex-col gap-3 p-6" style={{ animationDelay: `${i * 60}ms` }}>
                <p className="font-mono text-caption uppercase tracking-[0.08em] text-peel">{p.law}</p>
                <h3 className="font-display text-title2 font-semibold">{p.title}</h3>
                <p className="text-subhead text-ink-2">{p.body}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section
          id="color"
          eyebrow="02 · Color"
          title="One loud lemon, everything else warm"
          lede="Colors are semantic tokens in OKLCH, defined once in globals.css and redefined for dark mode. Every text pairing meets WCAG AA (4.5:1) in both themes, and control edges and focus rings meet 3:1."
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {swatches.map((s) => (
              <div key={s.token} className="flex flex-col gap-3">
                <div
                  className="flex aspect-[4/5] items-end rounded-tile p-4 shadow-card ring-[0.5px] ring-hairline"
                  style={{ background: `var(${s.token})`, color: s.text ?? "var(--on-ink)" }}
                >
                  <span className="font-display text-title2 font-semibold">Aa</span>
                </div>
                <div className="px-1">
                  <p className="text-headline">{s.name}</p>
                  <p className="font-mono text-caption text-ink-2">{s.token}</p>
                  <p className="mt-1 text-footnote text-ink-2">{s.note}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card className="flex flex-col gap-3 p-6">
              <p className="text-footnote font-semibold uppercase tracking-[0.06em] text-ink-3">Labels</p>
              {labels.map((l) => (
                <p key={l.token} className="flex items-baseline justify-between gap-4 text-title3 font-semibold" style={{ color: `var(${l.token})` }}>
                  {l.name}
                  <span className="font-mono text-caption">{l.token}</span>
                </p>
              ))}
            </Card>
            <Card className="flex flex-col gap-3 p-6">
              <p className="text-footnote font-semibold uppercase tracking-[0.06em] text-ink-3">Fills and separators</p>
              <div className="grid grid-cols-4 gap-3">
                {fills.map((f) => (
                  <div key={f} className="flex flex-col gap-2">
                    <div className="h-16 rounded-field" style={{ background: `var(${f})` }} />
                    <span className="font-mono text-caption text-ink-2">{f}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Section>

        <Section
          id="type"
          eyebrow="03 · Typography"
          title="A sign-painter's serif, Apple's system for the rest"
          lede="Fraunces, with its soft and wonky axes on, sets titles like a hand-painted sign. Everything else follows Apple: SF Pro for the interface, SF Pro Rounded for prices (fixed-width digits, so totals don't jitter) and SF Mono for codes. Other platforms get Hanken Grotesk. On iPhone and iPad, sizes follow the person's Dynamic Type setting."
        >
          <Card className="divide-y divide-hairline">
            {typeRamp.map((t) => (
              <div key={t.name} className="grid items-baseline gap-2 px-6 py-5 md:grid-cols-[10rem_1fr_auto] md:gap-6">
                <p className="text-footnote font-semibold text-ink-2">{t.name}</p>
                <p className={`${t.className} min-w-0 truncate`}>{t.sample}</p>
                <p className="font-mono text-caption text-ink-3">{t.spec}</p>
              </div>
            ))}
          </Card>
        </Section>

        <Section
          id="materials"
          eyebrow="04 · Materials & depth"
          title="Glass for chrome, paper for content"
          lede="Liquid glass floats controls over what they control: the total bar, toolbars, sheets, this sidebar. Content sits on opaque cards. Corners are concentric, so an inner radius is the outer radius minus the gap."
        >
          <div className="relative isolate overflow-hidden rounded-sheet bg-canvas-raised p-6 ring-[0.5px] ring-hairline sm:p-10">
            {/* Bold shapes behind the glass, so each material's blur and tint are visible. */}
            <div aria-hidden className="absolute inset-0 -z-10">
              <span className="absolute -top-16 left-[6%] size-64 rounded-full bg-lemon" />
              <span className="absolute top-[30%] left-[38%] size-56 rounded-full bg-leaf" />
              <span className="absolute -right-10 -bottom-20 size-72 rounded-full bg-pool" />
              <span className="absolute top-6 right-[24%] h-24 w-56 rotate-[-18deg] rounded-full bg-berry" />
              <span className="absolute bottom-4 left-[12%] text-[5rem] leading-none">🍋</span>
              <span className="absolute top-4 left-[56%] text-[4rem] leading-none">🧊</span>
              <span className="absolute right-[6%] bottom-10 text-[4.5rem] leading-none">🍪</span>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {(["thin", "regular", "thick"] as const).map((m) => (
                <Glass key={m} material={m} className="flex min-h-44 flex-col justify-between rounded-[30px] p-6">
                  <p className="font-mono text-caption text-ink-2">.glass{m === "regular" ? "" : `-${m}`}</p>
                  <div>
                    <p className="font-display text-title2 font-semibold capitalize">{m}</p>
                    <p className="text-subhead text-ink-2">
                      {m === "thin" ? "Hover chips and badges" : m === "regular" ? "Toolbars and total bar" : "Sheets and popovers"}
                    </p>
                  </div>
                </Glass>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {/* Elevation sits on the canvas, not a card, so the shadows have something to fall on. */}
            <div className="rounded-card bg-fill p-6 ring-[0.5px] ring-hairline">
              <p className="mb-5 text-footnote font-semibold uppercase tracking-[0.06em] text-ink-3">Elevation</p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  ["card", "shadow-card", "Content"],
                  ["float", "shadow-float", "Chrome"],
                  ["lift", "shadow-lift", "Sheets"],
                ].map(([name, cls, use]) => (
                  <div key={name} className="flex flex-col items-center gap-3">
                    <div className={`size-20 rounded-card bg-surface ring-[0.5px] ring-hairline ${cls}`} />
                    <span className="text-center leading-tight">
                      <span className="block font-mono text-caption text-ink-2">{name}</span>
                      <span className="block text-caption text-ink-3">{use}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Card className="flex items-center gap-6 p-6">
              <div className="grid size-40 shrink-0 place-items-center rounded-tile bg-lemon p-3 shadow-card">
                <div className="grid size-full place-items-center rounded-[18px] bg-[oklch(1_0_0/0.55)] p-3">
                  <div className="size-full rounded-[6px] bg-[oklch(0.23_0.03_85/0.85)]" />
                </div>
              </div>
              <div>
                <p className="text-footnote font-semibold uppercase tracking-[0.06em] text-ink-3">Concentric corners</p>
                <p className="mt-2 font-mono text-subhead">30 − 12 = 18</p>
                <p className="font-mono text-subhead">18 − 12 = 6</p>
                <p className="mt-2 text-subhead text-ink-2">Tiles 30 · sheets 38 · cards 22 · fields 14 · chips 10</p>
              </div>
            </Card>
          </div>
        </Section>

        <Section
          id="controls"
          eyebrow="05 · Controls"
          title="Capsules that answer the finger"
          lede="Buttons are capsules in four sizes, every one at least 44pt tall. A press dips to 95.5% on a spring and comes back with a slight overshoot."
        >
          <Card className="flex flex-col gap-8 p-6">
            <Row label="Variants">
              <Button variant="filled" icon={<QrCodeIcon />}>
                Charge
              </Button>
              <Button variant="lemon" icon={<PlusIcon />}>
                Add item
              </Button>
              <Button variant="tinted">Clear</Button>
              <Button variant="glass" icon={<CameraIcon />}>
                Retake
              </Button>
              <Button variant="plain">Edit prices</Button>
              <Button variant="destructive" icon={<XmarkIcon />}>
                Cancel sale
              </Button>
            </Row>
            <Row label="Sizes">
              <Button variant="filled" size="sm">
                Small
              </Button>
              <Button variant="filled" size="md">
                Medium
              </Button>
              <Button variant="filled" size="lg">
                Large
              </Button>
              <Button variant="filled" size="xl" icon={<QrCodeIcon />}>
                Charge
              </Button>
            </Row>
            <Row label="States">
              <Button variant="filled" size="lg" loading>
                Confirming…
              </Button>
              <Button variant="filled" size="lg" disabled>
                Charge
              </Button>
              <Button variant="tinted" size="lg" iconOnly aria-label="Add">
                <PlusIcon />
              </Button>
              <Spinner label="Loading" className="text-[1.75rem] text-ink-2" />
            </Row>
          </Card>
          <div className="mt-6">
            <ControlsDemo />
          </div>
        </Section>

        <Section
          id="commerce"
          eyebrow="06 · Commerce"
          title="Money, status and receipts"
          lede="Prices are set like a price tag, with the cents raised. Status pairs color, icon and word. Receipts use the grouped list, so a sale reads like a Settings page you already know."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="flex flex-col gap-6 p-6">
              <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                <Money cents={725} currency="USD" size="hero" />
                <Money cents={1250} currency="USD" size="title" />
                <Money cents={300} currency="USD" />
              </div>
              <div className="flex flex-wrap gap-2">
                <SaleStatusPill status="open" />
                <SaleStatusPill status="paid" />
                <SaleStatusPill status="canceled" />
                <ConfidencePill confidence="high" />
                <ConfidencePill confidence="low" />
                <FirstSalePill seconds={52} />
                <Pill tone="lemon" icon={<SparklesIcon />}>
                  New
                </Pill>
              </div>
              <div className="flex items-center gap-3">
                <CountBadge count={3} />
                <span className="text-subhead text-ink-2">Count badge, springs in when it changes</span>
              </div>
            </Card>
            <GroupedList header="Sale · 14:02" footer="Prices are snapshotted when the code is shown, so editing the sign later never changes a past sale.">
              <ListRow icon={<span className="text-[1.1rem]">🍋</span>} title="Lemonade" subtitle="2 × $2.50" trailing="$5.00" />
              <ListRow icon={<span className="text-[1.1rem]">🍪</span>} iconTone="leaf" title="Cookie" subtitle="1 × $1.50" trailing="$1.50" />
              <ListRow icon={<WalletIcon />} iconTone="pool" title="Paid with PayPal" subtitle="Capture verified" trailing={<CheckIcon className="text-leaf" />} />
              <ListRow icon={<ChartIcon />} iconTone="ink" title="Open stand recap" href="/stand/recap" />
            </GroupedList>
          </div>
          <Card className="mt-6 grid place-items-center p-10">
            <PaidMoment cents={650} currency="USD" />
          </Card>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-title2 font-semibold">Online store</h3>
                <p className="text-subhead text-ink-2">
                  StorefrontHeader tops a seller&rsquo;s store at /&lt;handle&gt;, and the editor previews with the same component.
                  Without a photo, the banner is a wash of the store&rsquo;s accent: lemon, leaf or berry.
                </p>
              </div>
              <StorefrontHeader
                title="Sunny Side Stand"
                intro={"Fresh-squeezed every morning.\nPick up by the park gate, or we\u2019ll post the merch."}
                accent="leaf"
              />
            </Card>
            <Card className="flex flex-col gap-5 p-6">
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-title2 font-semibold">Orders</h3>
                <p className="text-subhead text-ink-2">FulfillmentPill says where an online order is. AddressBlock lays out a shipping label.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <FulfillmentPill fulfillment={{ status: "to_ship" }} />
                <FulfillmentPill fulfillment={{ status: "shipped" }} />
                <FulfillmentPill fulfillment={{ status: "to_collect" }} />
                <FulfillmentPill fulfillment={{ status: "collected" }} />
              </div>
              {/* A made-up address. Never put a real buyer's address in the kit. */}
              <AddressBlock
                recipient="Pat Example"
                address={{ line1: "123 Citrus Lane", line2: "Unit 4", city: "Springfield", region: "OR", postalCode: "97000", country: "US" }}
              />
            </Card>
          </div>
          <Card className="mt-6 flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-title2 font-semibold">The lemon code</h3>
              <p className="text-subhead text-ink-2">
                A halftone QR: every module keeps a true-color center dot for the scanner, and the rest of it is tinted
                from a picture of Pal. Finder squares stay solid. Test on real phones before an event.
              </p>
            </div>
            <QrDemo />
          </Card>
        </Section>

        <Section
          id="register"
          eyebrow="07 · Register pattern"
          title="Everything together"
          lede="Tap tiles, tap Charge, show the code. The total bar floats in glass over the tiles so it never scrolls away. Try the minus, the sheet, and Escape to dismiss."
        >
          <RegisterDemo />
        </Section>

        <Section
          id="motion"
          eyebrow="08 · Motion"
          title="Springs, and a glow for thinking"
          lede="Inspired by iOS 26: things change shape instead of swapping, every move uses a named spring, and AI work glows rather than spins. Each pattern below says where it's used and what Reduce Motion turns it into."
        >
          <Card className="overflow-hidden">
            <ul className="divide-y divide-hairline">
              {motionPatterns.map((m) => (
                <li key={m.name} className="grid gap-x-6 gap-y-2 p-5 sm:p-6 lg:grid-cols-[11rem_minmax(0,1fr)_14rem]">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-headline">{m.name}</h3>
                    <code className="font-mono text-footnote break-words text-peel">{m.piece}</code>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-body">{m.body}</p>
                    <p className="text-footnote text-ink-2">Used in: {m.where}</p>
                  </div>
                  <p className="text-footnote text-ink-2">
                    <span className="font-semibold text-ink">Reduce Motion:</span> {m.reduced}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
          <div className="mt-6">
            <MotionDemo />
          </div>
          <div className="mt-6">
            <RevealDemo />
          </div>
        </Section>
      </main>
    </div>
  );
}

function Hero() {
  return (
    <header className="relative flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-sheet bg-lemon p-8 text-[oklch(0.23_0.03_85)] shadow-float sm:p-12">
      <div aria-hidden className="absolute -top-24 -right-16 size-[26rem] rounded-full bg-[radial-gradient(circle_at_35%_35%,oklch(1_0_0/0.7),transparent_60%)]" />
      <LemonIcon aria-hidden className="absolute top-8 right-8 text-[9rem] opacity-90 drop-shadow-[0_20px_30px_oklch(0.5_0.15_90/0.35)] sm:text-[13rem]" />
      <p className="relative animate-rise font-mono text-footnote uppercase tracking-[0.12em]">Lemon Pal · design kit · 2026</p>
      <h1 className="relative mt-3 max-w-3xl animate-rise font-display text-[clamp(3rem,8vw,6.5rem)] leading-[0.92] font-semibold tracking-[-0.04em] [animation-delay:80ms]">
        Citrus Glass
      </h1>
      <p className="relative mt-5 max-w-xl animate-rise text-title3 text-[oklch(0.23_0.03_85/0.78)] [animation-delay:160ms]">
        A warm, tactile system for selling lemonade from an iPad. Liquid glass chrome, sign-painter type, and targets
        made for thumbs.
      </p>
    </header>
  );
}

function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8">
      <p className="font-mono text-caption uppercase tracking-[0.1em] text-peel">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-2 font-display text-large-title font-semibold text-balance">
        {title}
      </h2>
      {lede ? <p className="mt-3 max-w-2xl text-body text-ink-2">{lede}</p> : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-footnote font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
