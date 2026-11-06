"use client";

import Link from "next/link";
import { addTransitionType, startTransition, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import {
  ArrowUturnIcon,
  Button,
  CameraIcon,
  ChartIcon,
  cn,
  ItemTile,
  LemonIcon,
  LemonQR,
  Money,
  PaidMoment,
  QrCodeIcon,
  SaleStatusPill,
  ScrollEdge,
  Toolbar,
  useScrollCompact,
  XmarkIcon,
} from "@/components/kit";
import { playDing, unlockDing } from "@/lib/ding";
import type { PublicSale } from "@/lib/sales";
import type { CatalogItem } from "@/lib/types";

/**
 * The register moves between screens with view transitions, so things change shape instead of swapping:
 * Charge grows into the code card and the total flies up to become the big price, Cancel folds them back,
 * and a paid code steps aside for the Paid moment. Only updates inside `startTransition` animate.
 */
function moveTo(type: "charge" | "paid" | "back", update: () => void) {
  startTransition(() => {
    addTransitionType(type);
    update();
  });
}

// The sale code with Pal imprinted in it. Set to false for a plain code with a lemon badge, if a phone struggles to scan.
const LEMON_ART_QR = true;

type Props = {
  standName: string;
  currency: string;
  items: CatalogItem[];
  /** Origin for the sale QR code, such as the dev machine's network address. null uses this page's origin. */
  payOrigin: string | null;
};

export function Register({ standName, currency, items, payOrigin }: Props) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sale, setSale] = useState<PublicSale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [charging, setCharging] = useState(false);
  const dingedSaleId = useRef<string | null>(null);
  const compactBar = useScrollCompact();

  // Ding once per sale, even if two status checks both see it paid.
  function dingFor(saleId: string) {
    if (dingedSaleId.current === saleId) return;
    dingedSaleId.current = saleId;
    playDing();
  }

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.priceCents * (cart[item.id] ?? 0), 0),
    [items, cart],
  );

  // Poll the saved sale status until it settles. The server only marks it paid after a verified capture.
  useEffect(() => {
    if (!sale || sale.status !== "open") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/sales/${sale.id}`, { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as PublicSale;
        if (next.status === "paid") dingFor(next.id);
        if (next.status !== "open") moveTo(next.status === "paid" ? "paid" : "back", () => setSale(next));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sale]);

  async function startSale() {
    unlockDing();
    setError(null);
    setCharging(true);
    try {
      await createSale();
    } catch {
      setError("Could not start the sale. Check the connection and try again.");
      setCharging(false);
    }
  }

  async function createSale() {
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cart: Object.entries(cart)
          .filter(([, quantity]) => quantity > 0)
          .map(([itemId, quantity]) => ({ itemId, quantity })),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setCharging(false);
      return setError(json.error ?? "Could not start the sale");
    }
    const created = json as PublicSale;
    // In the same update as the sale, so the button stops spinning in the frame it turns into the code.
    moveTo("charge", () => {
      setCharging(false);
      setSale(created);
    });
  }

  function reset() {
    moveTo("back", () => {
      setCart({});
      setSale(null);
    });
  }

  // Cancel on the server so the QR code can't be paid later. If the buyer already paid, show that instead.
  async function cancel() {
    if (!sale) return;
    const res = await fetch(`/api/sales/${sale.id}/cancel`, { method: "POST" });
    const next = res.ok ? ((await res.json()) as PublicSale) : null;
    if (next?.status === "paid") {
      dingFor(next.id);
      moveTo("paid", () => setSale(next));
    } else {
      reset();
    }
  }

  if (sale) {
    const open = sale.status === "open";
    return (
      <main
        className={cn(
          // justify-center-safe: when the content is taller than the screen, it starts at the top instead of
          // being pushed above it, out of reach.
          "mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center-safe gap-7 px-5 py-10 text-center tight:gap-4 tight:py-6",
          // A phone on its side: the code on the left at full height, everything else beside it.
          open && "short:grid short:max-w-4xl short:grid-cols-[auto_minmax(0,1fr)] short:gap-x-10 short:gap-y-5 short:py-5",
        )}
      >
        {sale.status === "paid" ? (
          <PaidMoment
            cents={sale.totalCents}
            currency={sale.currency}
            firstSaleSeconds={sale.firstSaleSeconds}
            className="animate-rise"
          />
        ) : (
          <>
            <div className="flex flex-col items-center gap-7 tight:gap-3 short:col-start-2 short:row-start-1 short:gap-4 short:self-end">
              <SaleStatusPill status={sale.status} />
              <ViewTransition name="sale-total" share="morph" default="none">
                <Money cents={sale.totalCents} currency={sale.currency} size="hero" />
              </ViewTransition>
            </div>
            {open ? (
              <ViewTransition name="sale-card" share="morph" exit="step-aside" default="none">
                <div className="rounded-[34px] bg-lemon p-4 shadow-float short:col-start-1 short:row-span-2 short:row-start-1">
                  <LemonQR
                    value={`${payOrigin ?? window.location.origin}/pay/${sale.id}`}
                    label="Scan to pay with PayPal"
                    art={LEMON_ART_QR}
                    // As big as fits without scrolling: the rest of the screen takes about 27rem of height, or
                    // 4.5rem beside the code on a phone on its side. Never smaller than a phone can scan from a step away.
                    className="size-[min(22rem,75vw,max(11rem,calc(100dvh_-_27rem)))] tight:size-[min(75vw,max(11rem,calc(100dvh_-_22rem)))] short:size-[min(22rem,calc(100dvh_-_4.5rem))]"
                  />
                </div>
              </ViewTransition>
            ) : null}
            <div className="flex flex-col items-center gap-7 tight:gap-4 short:col-start-2 short:row-start-2 short:gap-5 short:self-start">
              <p className="max-w-xs text-body text-ink-2">
                {open
                  ? "Point your phone camera at the code. You\u2019ll pay with PayPal."
                  : "This sale was canceled. Start a new one for the next customer."}
              </p>
              {open ? (
                <Button variant="destructive" size="lg" icon={<XmarkIcon />} onClick={cancel}>
                  Cancel sale
                </Button>
              ) : null}
            </div>
          </>
        )}
        {!open ? (
          <Button variant="filled" size="xl" className="min-w-64 max-w-full" onClick={reset}>
            Next customer
          </Button>
        ) : null}
      </main>
    );
  }

  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-8 pb-44 sm:px-8">
      <ScrollEdge />
      <ScrollEdge edge="bottom" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-footnote font-semibold text-ink-2">
            <LemonIcon className="text-[1.1rem]" /> Register
          </p>
          <h1 className="font-display text-large-title font-semibold">{standName}</h1>
        </div>
        <Toolbar aria-label="Stand">
          <Link href="/stand/setup" transitionTypes={["nav-back"]} className={toolbarLink}>
            <CameraIcon /> Sign
          </Link>
          <Link href="/stand/recap" transitionTypes={["nav-forward"]} className={toolbarLink}>
            <ChartIcon /> Recap
          </Link>
        </Toolbar>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <ItemTile
            key={item.id}
            name={item.name}
            emoji={item.emoji}
            image={item.image}
            priceCents={item.priceCents}
            currency={currency}
            count={cart[item.id] ?? 0}
            onAdd={() => setCart((c) => ({ ...c, [item.id]: (c[item.id] ?? 0) + 1 }))}
            onRemove={() => setCart((c) => ({ ...c, [item.id]: Math.max(0, (c[item.id] ?? 0) - 1) }))}
          />
        ))}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {error ? (
          <p role="alert" className="glass pointer-events-auto rounded-full px-4 py-2 text-subhead font-semibold text-berry">
            {error}
          </p>
        ) : null}
        <div
          data-compact={compactBar || undefined}
          className="glass minimizable pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-full p-2 pl-3"
        >
          <Button
            variant="tinted"
            size="lg"
            iconOnly
            aria-label="Clear sale"
            icon={<ArrowUturnIcon />}
            disabled={count === 0 || charging}
            onClick={() => setCart({})}
          />
          <div className="flex min-w-0 flex-1 flex-col leading-tight" aria-live="polite">
            <span className="truncate text-footnote text-ink-2">
              {count === 0 ? "Tap an item to start" : `${count} ${count === 1 ? "item" : "items"}`}
            </span>
            <ViewTransition name="sale-total" share="morph" default="none">
              <Money cents={total} currency={currency} size="title" rolling className="self-start" />
            </ViewTransition>
          </div>
          <ViewTransition name="sale-card" share="morph" default="none">
            <Button
              variant="filled"
              size="xl"
              // Narrow phones: no icon and less padding, so the total beside it keeps its room.
              icon={<QrCodeIcon className="max-[24rem]:hidden" />}
              className="max-[24rem]:px-5"
              disabled={total === 0}
              loading={charging}
              onClick={startSale}
            >
              Charge
            </Button>
          </ViewTransition>
        </div>
      </div>
    </main>
  );
}

const toolbarLink =
  "pressable focus-ring inline-flex h-11 items-center gap-2 rounded-full px-5 text-callout font-semibold text-ink hover:bg-fill-2 [&_svg]:text-[1.15em]";
