"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowUturnIcon,
  BagIcon,
  Button,
  ItemTile,
  Money,
  ScrollEdge,
  SegmentedControl,
  useScrollCompact,
} from "@/components/kit";
import { dealDiscount, dealLabel, type Deal } from "@/lib/deals";
import { formatMoney, type Cents } from "@/lib/money";
import { countryName, shippingCents, type FulfillmentMethod } from "@/lib/shipping";
import type { ShippingSettings } from "@/lib/types";

export type StoreItem = {
  id: string;
  name: string;
  priceCents: Cents;
  emoji?: string;
  image?: string;
  deal?: Deal;
  ships: boolean;
};

type Props = {
  handle: string;
  currency: string;
  open: boolean;
  methods: FulfillmentMethod[];
  shipping: ShippingSettings;
  pickupNote: string;
  items: StoreItem[];
  /** The seller looking at their own store. The cart works, even on a closed store, and Checkout opens a preview pay page. */
  preview?: boolean;
};

export function StoreCart({ handle, currency, open: storeOpen, methods, shipping, pickupNote, items, preview = false }: Props) {
  // A preview lets the seller try the cart either way. Only real buyers are held to the store being open.
  const open = storeOpen || preview;
  const router = useRouter();
  const [method, setMethod] = useState<FulfillmentMethod>(methods[0] ?? "pickup");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const compactBar = useScrollCompact();

  // Shipping shows only what can be posted. Switching to it drops pickup-only items from the cart.
  const shown = method === "ship" ? items.filter((item) => item.ships) : items;

  function choose(next: FulfillmentMethod) {
    setMethod(next);
    if (next === "ship") {
      setCart((current) => Object.fromEntries(Object.entries(current).filter(([id]) => items.find((i) => i.id === id)?.ships)));
    }
  }

  // For display only. The server prices the order again from the stored catalog and settings.
  const { count, subtotal } = useMemo(() => {
    let count = 0;
    let subtotal = 0;
    for (const item of shown) {
      const quantity = cart[item.id] ?? 0;
      count += quantity;
      subtotal += item.priceCents * quantity - dealDiscount(item.priceCents, quantity, item.deal);
    }
    return { count, subtotal };
  }, [shown, cart]);
  const shippingCost = method === "ship" && count > 0 ? shippingCents(shipping, subtotal) : 0;
  const total = subtotal + shippingCost;

  async function checkout() {
    const entries = Object.entries(cart).filter(([, quantity]) => quantity > 0);
    // A preview shows the pay page from the cart alone. Nothing is posted, so no sale is created.
    if (preview) {
      const query = new URLSearchParams({ method, cart: entries.map(([id, quantity]) => `${id}.${quantity}`).join(",") });
      return router.push(`/${encodeURIComponent(handle)}/checkout?${query}`, { transitionTypes: ["nav-forward"] });
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/store/${encodeURIComponent(handle)}/sales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        cart: entries.map(([itemId, quantity]) => ({ itemId, quantity })),
      }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (res?.ok && json?.saleId) return router.push(`/pay/${json.saleId}`, { transitionTypes: ["nav-forward"] });
    setBusy(false);
    setError(json?.error ?? "Couldn’t start your order. Check your connection and try again.");
  }

  const shipNote =
    shipping.freeOverCents !== null
      ? `Free over ${formatMoney(shipping.freeOverCents, currency)}`
      : `Ships to ${shipping.countries.map((code) => countryName(code)).join(", ")}`;

  return (
    <>
      <ScrollEdge />
      <ScrollEdge edge="bottom" />

      {methods.length > 1 && open ? (
        <SegmentedControl
          label="How to get your order"
          className="mt-8 max-w-sm"
          value={method}
          onChange={choose}
          options={[
            { value: "pickup", label: "Pick up" },
            { value: "ship", label: "Shipping" },
          ]}
        />
      ) : null}
      <p className="mt-3 px-1 text-footnote text-ink-2">
        {method === "ship"
          ? `${formatMoney(shipping.flatRateCents, currency)} shipping · ${shipNote}`
          : pickupNote || "Pick up from the seller."}
      </p>

      {shown.length === 0 ? (
        <p className="mt-8 text-body text-ink-2">Nothing here ships. Choose pickup to see everything.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {shown.map((item) => (
            <ItemTile
              key={item.id}
              name={item.name}
              emoji={item.emoji}
              image={item.image}
              deal={item.deal ? dealLabel(item.deal, currency) : undefined}
              priceCents={item.priceCents}
              currency={currency}
              count={cart[item.id] ?? 0}
              onAdd={open ? () => setCart((c) => ({ ...c, [item.id]: Math.min(99, (c[item.id] ?? 0) + 1) })) : undefined}
              onRemove={() => setCart((c) => ({ ...c, [item.id]: Math.max(0, (c[item.id] ?? 0) - 1) }))}
            />
          ))}
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {error ? (
          <p role="alert" className="glass pointer-events-auto max-w-2xl rounded-[22px] px-4 py-2 text-center text-subhead font-semibold text-berry">
            {error}
          </p>
        ) : null}
        {open ? (
          <div
            data-compact={compactBar || undefined}
            className="glass minimizable pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-full p-2 pl-3"
          >
            <Button
              variant="ghost"
              size="lg"
              iconOnly
              aria-label="Empty cart"
              icon={<ArrowUturnIcon />}
              disabled={count === 0 || busy}
              onClick={() => setCart({})}
            />
            <div className="flex min-w-0 flex-1 flex-col leading-tight" aria-live="polite">
              <span className="truncate text-footnote text-ink-2">
                {count === 0
                  ? "Tap an item to add it"
                  : `${count} ${count === 1 ? "item" : "items"} · ${
                      method === "ship" ? (shippingCost ? `${formatMoney(shippingCost, currency)} shipping` : "free shipping") : "pickup"
                    }`}
              </span>
              <Money cents={total} currency={currency} size="title" rolling className="self-start" />
            </div>
            <Button
              variant="filled"
              size="xl"
              icon={<BagIcon className="max-[24rem]:hidden" />}
              className="max-[24rem]:px-5"
              disabled={count === 0}
              loading={busy}
              onClick={checkout}
            >
              Checkout
            </Button>
          </div>
        ) : (
          <p className="glass pointer-events-auto rounded-full px-5 py-3 text-subhead font-semibold">This store isn’t taking orders right now.</p>
        )}
      </div>
    </>
  );
}
