"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { formatMoney } from "@/lib/money";
import type { PublicSale } from "@/lib/sales";
import type { CatalogItem } from "@/lib/types";

type Props = { standName: string; currency: string; items: CatalogItem[] };

export function Register({ standName, currency, items }: Props) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sale, setSale] = useState<PublicSale | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        if (next.status !== "open") setSale(next);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sale]);

  async function startSale() {
    setError(null);
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
    setQr(await QRCode.toDataURL(`${window.location.origin}/pay/${created.id}`, { margin: 2, width: 320 }));
    setSale(created);
  }

  function reset() {
    setCart({});
    setSale(null);
    setQr(null);
  }

  if (sale) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-10 text-center">
        <p className="text-5xl font-bold">{formatMoney(sale.totalCents, sale.currency)}</p>
        {sale.status === "paid" ? (
          <p className="text-6xl font-bold text-leaf">🍋 Paid</p>
        ) : (
          qr && (
            <div className="rounded-3xl bg-lemon p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the qrcode package */}
              <img src={qr} alt="Scan to pay with PayPal" width={320} height={320} className="rounded-xl bg-white" />
            </div>
          )
        )}
        <p className="opacity-70">{sale.status === "open" ? "Scan with your phone camera to pay" : null}</p>
        <button onClick={reset} className="rounded-xl border-2 px-6 py-3 text-lg">
          {sale.status === "paid" ? "Next customer" : "Cancel"}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="text-2xl font-bold">{standName}</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setCart((c) => ({ ...c, [item.id]: (c[item.id] ?? 0) + 1 }))}
            className="relative aspect-square rounded-3xl border-4 border-lemon-deep bg-lemon/50 p-4 text-left active:bg-lemon"
          >
            <span className="block text-2xl font-semibold">{item.name}</span>
            <span className="block text-xl">{formatMoney(item.priceCents, currency)}</span>
            {cart[item.id] ? (
              <span className="absolute right-3 top-3 rounded-full bg-foreground px-3 py-1 text-background">
                {cart[item.id]}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between gap-4">
        <button onClick={() => setCart({})} className="rounded-xl border-2 px-5 py-3">
          Clear
        </button>
        <span className="text-3xl font-bold">{formatMoney(total, currency)}</span>
        <button
          onClick={startSale}
          disabled={total === 0}
          className="rounded-xl bg-foreground px-6 py-3 text-lg text-background disabled:opacity-40"
        >
          Charge
        </button>
      </div>
      {error ? <p className="mt-4 text-red-600">{error}</p> : null}
    </main>
  );
}
