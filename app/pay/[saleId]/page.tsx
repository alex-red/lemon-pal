import { notFound } from "next/navigation";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { Money, PaidMoment, SaleStatusPill } from "@/components/kit";
import { store } from "@/lib/store";
import { OrderSummary } from "../order-summary";
import { Checkout } from "./checkout";

// Buyer checkout opened from the QR code. Keep this page small: it loads on a phone over cell data.
export default async function PayPage({ params }: { params: Promise<{ saleId: string }> }) {
  await connection();
  const { saleId } = await params;
  const sale = await store.getSale(saleId);
  if (!sale) notFound();
  const stand = await store.getStand(sale.standId);
  const online = sale.channel === "online";
  const gift = sale.channel === "donation";
  const storefront = online || gift ? await store.getStorefront(sale.standId) : null;
  // A gift from the display's typed amount has a page too, but only an open one is worth going back to.
  const storeUrl = storefront && (online || storefront.open) ? `/${storefront.slug}` : undefined;
  const backLabel = gift ? "Give again" : "Back to the store";
  const fulfillment = sale.fulfillment;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <OrderSummary
        eyebrow={sale.status === "refunded" ? "Refunded by" : gift ? "You’re giving to" : "You’re paying"}
        gift={gift}
        title={storefront?.title || stand?.name || "Lemon Pal"}
        currency={sale.currency}
        lines={sale.lines}
        totalCents={sale.totalCents}
        shippingCents={sale.shippingCents}
        fulfillment={fulfillment}
        pickupNote={storefront?.pickupNote}
      />

      {sale.status === "paid" ? (
        <PaidMoment
          cents={sale.totalCents}
          currency={sale.currency}
          caption={
            gift
              ? `${storefront?.donation?.thanks || "Thank you!"} PayPal will email you a receipt.`
              : fulfillment?.method === "ship"
                ? "Thank you! PayPal will email you a receipt, and the seller will post your order."
                : "Thank you! PayPal will email you a receipt."
          }
          className="pt-4"
        />
      ) : sale.status === "refunded" ? (
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <SaleStatusPill status="refunded" size="lg" />
          <p className="text-body">
            <span className="font-semibold">{gift ? "Your gift was refunded." : "The seller refunded this sale."}</span>{" "}
            <span className="text-ink-2">
              PayPal is sending <Money cents={sale.totalCents} currency={sale.currency} /> back to you, and will email you when it arrives.
            </span>
          </p>
          {storeUrl ? <StoreLink href={storeUrl} label={backLabel} /> : null}
        </div>
      ) : sale.status === "canceled" ? (
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <SaleStatusPill status="canceled" />
          <p className="text-body text-ink-2">
            {online
              ? "This order can’t be paid any more. Start a new one from the store."
              : gift && storeUrl
                ? "This gift can’t be paid any more. Start again from the page."
                : "The seller canceled this sale. Ask them for a new code."}
          </p>
          {storeUrl ? <StoreLink href={storeUrl} label={backLabel} /> : null}
        </div>
      ) : (
        <Checkout
          saleId={sale.id}
          clientId={env.paypalClientId()}
          sdkUrl={env.paypalSdkUrl()}
          currency={sale.currency}
          totalCents={sale.totalCents}
          storeUrl={storeUrl}
          pending={Boolean(sale.pendingCapture)}
        />
      )}

      {sale.status === "paid" && storeUrl ? (
        <div className="flex justify-center">
          <StoreLink href={storeUrl} label={backLabel} />
        </div>
      ) : null}
    </main>
  );
}

function StoreLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="pressable focus-ring inline-flex h-11 items-center rounded-full bg-fill-2 px-5 text-callout font-semibold text-ink hover:bg-fill-3"
    >
      {label}
    </a>
  );
}
