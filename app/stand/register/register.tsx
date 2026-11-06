"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUturnIcon,
  Button,
  CameraIcon,
  ChartIcon,
  ItemTile,
  LemonIcon,
  LemonQR,
  Money,
  PaidMoment,
  QrCodeIcon,
  SaleStatusPill,
  Toolbar,
  XmarkIcon,
} from "@/components/kit";
import { playDing, unlockDing } from "@/lib/ding";
import type { PublicSale } from "@/lib/sales";
import type { CatalogItem } from "@/lib/types";

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
        if (next.status !== "open") setSale(next);
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
    } finally {
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
    if (!res.ok) return setError(json.error ?? "Could not start the sale");
    const created = json as PublicSale;
    setSale(created);
  }

  function reset() {
    setCart({});
    setSale(null);
  }

  // Cancel on the server so the QR code can't be paid later. If the buyer already paid, show that instead.
  async function cancel() {
    if (!sale) return;
    const res = await fetch(`/api/sales/${sale.id}/cancel`, { method: "POST" });
    const next = res.ok ? ((await res.json()) as PublicSale) : null;
    if (next?.status === "paid") {
      dingFor(next.id);
      setSale(next);
    } else {
      reset();
    }
  }

  if (sale) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-7 px-5 py-10 text-center">
        {sale.status === "paid" ? (
          <PaidMoment cents={sale.totalCents} currency={sale.currency} className="animate-rise" />
        ) : (
          <>
            <SaleStatusPill status={sale.status} />
            <Money cents={sale.totalCents} currency={sale.currency} size="hero" />
            {sale.status === "open" ? (
              <div className="animate-rise rounded-[34px] bg-lemon p-4 shadow-float">
                <LemonQR
                  value={`${payOrigin ?? window.location.origin}/pay/${sale.id}`}
                  label="Scan to pay with PayPal"
                  art={LEMON_ART_QR}
                  className="size-[min(22rem,75vw)]"
                />
              </div>
            ) : null}
            <p className="max-w-xs text-body text-ink-2">
              {sale.status === "open"
                ? "Point your phone camera at the code. You\u2019ll pay with PayPal."
                : "This sale was canceled. Start a new one for the next customer."}
            </p>
          </>
        )}
        {sale.status === "open" ? (
          <Button variant="destructive" size="lg" icon={<XmarkIcon />} onClick={cancel}>
            Cancel sale
          </Button>
        ) : (
          <Button variant="filled" size="xl" className="min-w-64" onClick={reset}>
            Next customer
          </Button>
        )}
      </main>
    );
  }

  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-8 pb-44 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-footnote font-semibold text-ink-2">
            <LemonIcon className="text-[1.1rem]" /> Register
          </p>
          <h1 className="font-display text-large-title font-semibold">{standName}</h1>
        </div>
        <Toolbar aria-label="Stand">
          <Link href="/stand/setup" className={toolbarLink}>
            <CameraIcon /> Sign
          </Link>
          <Link href="/stand/recap" className={toolbarLink}>
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
        <div className="glass pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-full p-2 pl-3">
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
            <span className="text-footnote text-ink-2">
              {count === 0 ? "Tap an item to start" : `${count} ${count === 1 ? "item" : "items"}`}
            </span>
            <Money cents={total} currency={currency} size="title" />
          </div>
          <Button variant="filled" size="xl" icon={<QrCodeIcon />} disabled={total === 0} loading={charging} onClick={startSale}>
            Charge
          </Button>
        </div>
      </div>
    </main>
  );
}

const toolbarLink =
  "pressable focus-ring inline-flex h-11 items-center gap-2 rounded-full px-5 text-callout font-semibold text-ink hover:bg-fill-2 [&_svg]:text-[1.15em]";
