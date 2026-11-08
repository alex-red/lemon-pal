"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  AddressBlock,
  addressText,
  BoxIcon,
  Button,
  Card,
  ChartIcon,
  CheckIcon,
  ExclamationIcon,
  FulfillmentPill,
  GroupedList,
  LinkIcon,
  ListRow,
  Pill,
  PinIcon,
  SegmentedControl,
  Sheet,
  TextField,
  Toolbar,
} from "@/components/kit";
import { lineTotalCents } from "@/lib/deals";
import { formatMoney } from "@/lib/money";
import type { SellerOrder } from "@/lib/orders";
import { standApi } from "@/lib/stands";
import type { ShippingCarrier } from "@/lib/types";

const CARRIERS: { value: ShippingCarrier; label: string }[] = [
  { value: "USPS", label: "USPS" },
  { value: "UPS", label: "UPS" },
  { value: "FEDEX", label: "FedEx" },
  { value: "DHL", label: "DHL" },
  { value: "OTHER", label: "Other" },
];

function when(iso: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function orderTitle(order: SellerOrder) {
  if (order.fulfillment.method === "ship" && order.fulfillment.recipient) return order.fulfillment.recipient;
  return order.buyerName ?? `Order ${order.id.slice(0, 4).toUpperCase()}`;
}

export function Orders({
  standId,
  switcher,
  assistant,
  initial,
  hasStore,
}: {
  standId: string;
  /** The stand switcher, shown above the title. */
  switcher: ReactNode;
  /** Opens Pal, the stand assistant. */
  assistant?: ReactNode;
  initial: SellerOrder[];
  hasStore: boolean;
}) {
  const [orders, setOrders] = useState(initial);
  // A refresh, such as after Pal marks an order shipped, brings a newer list from the server.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setOrders(initial);
  }
  const [openId, setOpenId] = useState<string | null>(null);

  // New orders arrive while the page is open.
  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch(standApi("/api/stand/orders", standId), { cache: "no-store" }).catch(() => null);
      if (res?.ok) setOrders((await res.json()).orders);
    }, 10_000);
    return () => clearInterval(timer);
  }, [standId]);

  const toShip = orders.filter((o) => o.fulfillment.status === "to_ship");
  const toCollect = orders.filter((o) => o.fulfillment.status === "to_collect");
  const done = orders.filter((o) => o.fulfillment.status === "shipped" || o.fulfillment.status === "collected");
  const selected = orders.find((o) => o.id === openId) ?? null;

  function replace(next: SellerOrder) {
    setOrders((current) => current.map((o) => (o.id === next.id ? next : o)));
  }

  const row = (order: SellerOrder) => (
    <li key={order.id} className="group">
      <button
        type="button"
        onClick={() => setOpenId(order.id)}
        className="focus-ring flex w-full items-center gap-3.5 pl-4 text-left transition-colors hover:bg-fill active:bg-fill-2"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-fill-2 text-[1.15rem] text-ink [&_svg]:stroke-[2]">
          {order.fulfillment.method === "ship" ? <BoxIcon /> : <PinIcon />}
        </span>
        <span className="flex min-h-[3.75rem] min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 shadow-[0_0.5px_0_0_var(--hairline)] group-last:shadow-none">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body">{orderTitle(order)}</span>
            <span className="block truncate text-subhead text-ink-2">
              {when(order.paidAt)} · {order.lines.reduce((n, l) => n + l.quantity, 0)} items
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-body font-semibold tabular-nums">{formatMoney(order.totalCents, order.currency)}</span>
            <FulfillmentPill fulfillment={order.fulfillment} />
          </span>
        </span>
      </button>
    </li>
  );

  const section = (header: string, list: SellerOrder[]) =>
    list.length ? (
      <section className="flex flex-col gap-2">
        <h2 className="px-5 text-footnote font-semibold uppercase tracking-[0.06em] text-ink-2">
          {header} · {list.length}
        </h2>
        <ul className="overflow-hidden rounded-card bg-surface shadow-card ring-[0.5px] ring-hairline">{list.map(row)}</ul>
      </section>
    ) : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 pt-8 pb-16 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {switcher}
          <h1 className="font-display text-large-title font-semibold">Orders</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {assistant}
          <Toolbar aria-label="Store">
            <Link href="/stand/store" transitionTypes={["nav-back"]} className={toolbarLink}>
              <LinkIcon /> Store
            </Link>
            <Link href="/stand/recap" transitionTypes={["nav-forward"]} className={toolbarLink}>
              <ChartIcon /> Recap
            </Link>
          </Toolbar>
        </div>
      </header>

      {orders.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <BoxIcon className="text-[2.5rem] text-ink-3" />
          <p className="text-headline">No online orders yet</p>
          <p className="max-w-sm text-body text-ink-2">
            {hasStore ? "Paid orders from your store show up here." : "Set up your online store and share its link to take orders."}
          </p>
          {!hasStore ? (
            <Link href="/stand/store" className="mt-2 font-semibold text-peel underline underline-offset-2">
              Set up your store
            </Link>
          ) : null}
        </Card>
      ) : (
        <>
          {section("To ship", toShip)}
          {section("To pick up", toCollect)}
          {section("Done", done)}
        </>
      )}

      <Sheet open={selected !== null} onClose={() => setOpenId(null)} title={selected ? orderTitle(selected) : "Order"}>
        {selected ? <OrderDetail key={selected.id} order={selected} onChange={replace} /> : null}
      </Sheet>
    </main>
  );
}

function OrderDetail({ order, onChange }: { order: SellerOrder; onChange: (order: SellerOrder) => void }) {
  const f = order.fulfillment;
  const [carrier, setCarrier] = useState<ShippingCarrier>(f.method === "ship" ? (f.carrier ?? "USPS") : "USPS");
  const [carrierName, setCarrierName] = useState(f.method === "ship" ? (f.carrierName ?? "") : "");
  const [tracking, setTracking] = useState(f.method === "ship" ? (f.tracking ?? "") : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function act(body: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/stand/orders/${order.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok && json) onChange(json as SellerOrder);
    else setError(json?.error ?? "Couldn’t update the order. Try again.");
  }

  async function copyAddress() {
    if (f.method !== "ship" || !f.address) return;
    await navigator.clipboard?.writeText(addressText(f.recipient, f.address)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <FulfillmentPill fulfillment={f} />
        <span className="text-subhead text-ink-2">Paid {when(order.paidAt)}</span>
      </div>

      {f.method === "ship" ? (
        f.address ? (
          <Card className="flex items-start justify-between gap-4 p-5">
            <AddressBlock recipient={f.recipient} address={f.address} />
            <Button variant="tinted" size="sm" icon={copied ? <CheckIcon /> : undefined} onClick={copyAddress}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </Card>
        ) : (
          <p className="text-body text-ink-2">PayPal didn’t return an address for this order. Check it in your PayPal account.</p>
        )
      ) : (
        <p className="text-body text-ink-2">{order.buyerName ? `${order.buyerName} will pick this up.` : "The buyer will pick this up."}</p>
      )}

      <GroupedList>
        {order.lines.map((line) => (
          <ListRow
            key={line.itemId}
            icon={line.emoji ? <span className="text-[1.1rem]">{line.emoji}</span> : undefined}
            title={`${line.quantity} × ${line.name}`}
            trailing={formatMoney(lineTotalCents(line), order.currency)}
          />
        ))}
        {f.method === "ship" ? (
          <ListRow
            icon={<BoxIcon />}
            iconTone="pool"
            title="Shipping"
            trailing={order.shippingCents ? formatMoney(order.shippingCents, order.currency) : "Free"}
          />
        ) : null}
        <ListRow title={<span className="font-semibold">Total</span>} trailing={<span className="font-semibold text-ink">{formatMoney(order.totalCents, order.currency)}</span>} />
      </GroupedList>

      {f.method === "ship" && f.status === "shipped" ? (
        <div className="flex flex-col gap-2">
          <p className="text-body">
            Shipped {f.shippedAt ? when(f.shippedAt) : ""}
            {f.tracking ? ` · ${f.carrier === "OTHER" ? f.carrierName || "Other" : CARRIERS.find((c) => c.value === f.carrier)?.label} ${f.tracking}` : ""}
          </p>
          {f.tracking ? (
            f.trackingSentToPayPal ? (
              <Pill tone="leaf" icon={<CheckIcon strokeWidth={2.25} />} className="self-start">
                Tracking sent to PayPal
              </Pill>
            ) : (
              <Pill tone="lemon" icon={<ExclamationIcon />} className="self-start">
                PayPal didn’t take the tracking number
              </Pill>
            )
          ) : null}
        </div>
      ) : null}

      {f.method === "ship" && f.status === "to_ship" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void act({ action: "ship", carrier, carrierName: carrier === "OTHER" ? carrierName : undefined, tracking: tracking.trim() || undefined });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <p className="px-1 text-footnote font-semibold text-ink-2">Carrier</p>
            <SegmentedControl label="Carrier" value={carrier} onChange={setCarrier} options={CARRIERS} className="[&_label]:px-2" />
          </div>
          {carrier === "OTHER" ? (
            <TextField label="Carrier name" value={carrierName} maxLength={60} onChange={(event) => setCarrierName(event.target.value)} />
          ) : null}
          <TextField
            label="Tracking number"
            placeholder="Optional"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={tracking}
            maxLength={64}
            onChange={(event) => setTracking(event.target.value)}
            hint="With a number, PayPal shows the buyer where their order is."
          />
          {error ? (
            <p role="alert" className="text-subhead font-semibold text-berry">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="filled" size="lg" icon={<BoxIcon />} loading={busy}>
            Mark shipped
          </Button>
        </form>
      ) : null}

      {f.method === "pickup" && f.status === "to_collect" ? (
        <>
          {error ? (
            <p role="alert" className="text-subhead font-semibold text-berry">
              {error}
            </p>
          ) : null}
          <Button variant="filled" size="lg" icon={<CheckIcon />} loading={busy} onClick={() => act({ action: "collect" })}>
            Mark picked up
          </Button>
        </>
      ) : null}
    </div>
  );
}

const toolbarLink =
  "pressable focus-ring inline-flex h-11 items-center gap-2 rounded-full px-5 text-callout font-semibold text-ink hover:bg-fill-2 [&_svg]:text-[1.15em] max-[24rem]:px-4 max-[24rem]:[&_svg]:hidden";
