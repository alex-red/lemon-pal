"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import { ExclamationIcon, PaidMoment, Pill, Spinner } from "@/components/kit";
import type { Cents } from "@/lib/money";
import type { PayPalOneTimePaymentSession } from "@/types/paypal-web-sdk";

type Props = {
  saleId: string;
  clientId: string;
  sdkUrl: string;
  currency: string;
  totalCents: Cents;
  /** The online store this order came from, for starting again when this sale can't be paid. */
  storeUrl?: string;
};

type State =
  | { kind: "loading" }
  | { kind: "ready"; message?: string }
  | { kind: "capturing" }
  | { kind: "paid" }
  | { kind: "failed"; message: string; restart?: boolean };

/** A failed request. `restart` means this sale can't be paid any more and the buyer has to start a new one. */
class RequestError extends Error {
  constructor(
    message: string,
    readonly restart: boolean,
  ) {
    super(message);
  }
}

async function postJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "POST" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new RequestError(json.error ?? `Request failed (${res.status})`, json.restart === true);
  return json as T;
}

export function Checkout({ saleId, clientId, sdkUrl, currency, totalCents, storeUrl }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const session = useRef<PayPalOneTimePaymentSession | null>(null);

  async function onSdkReady() {
    // next/script can fire onReady again after client-side navigation; set up once.
    if (session.current || !window.paypal) return;
    try {
      const sdk = await window.paypal.createInstance({ clientId, components: ["paypal-payments"], pageType: "checkout" });
      const methods = await sdk.findEligibleMethods({ currencyCode: currency });
      if (!methods.isEligible("paypal")) {
        return setState({ kind: "failed", message: "PayPal isn't available in this browser." });
      }
      session.current = sdk.createPayPalOneTimePaymentSession({
        async onApprove() {
          setState({ kind: "capturing" });
          try {
            await postJson(`/api/sales/${saleId}/capture`);
            setState({ kind: "paid" });
          } catch (error) {
            if (error instanceof RequestError && error.restart) {
              return setState({ kind: "failed", message: error.message, restart: true });
            }
            setState({ kind: "ready", message: `${(error as Error).message} Please try again.` });
          }
        },
        onCancel() {
          setState({ kind: "ready", message: "Payment canceled. You can try again." });
        },
        onError(error) {
          console.error("PayPal error", error);
          setState({ kind: "ready", message: "Something went wrong with PayPal. Please try again." });
        },
      });
      // Coming back from a full-page redirect to PayPal: finish the payment.
      if (session.current.hasReturned()) await session.current.resume();
      else setState({ kind: "ready" });
    } catch (error) {
      console.error(error);
      setState({ kind: "failed", message: "Couldn't load PayPal. Check your connection and reload." });
    }
  }

  function pay() {
    if (!session.current) return;
    setState({ kind: "ready" });
    // Don't await before start(): browsers only allow the PayPal window during the tap itself.
    const orderPromise = postJson<{ orderId: string }>(`/api/sales/${saleId}/order`);
    session.current.start({ presentationMode: "auto" }, orderPromise).catch((error: Error) => {
      console.error(error);
      setState({ kind: "ready", message: error.message || "Couldn't start PayPal. Please try again." });
    });
  }

  if (state.kind === "paid") {
    return <PaidMoment cents={totalCents} currency={currency} className="pt-4" />;
  }

  return (
    <div className="flex flex-col items-center gap-4 pt-2" aria-live="polite">
      <Script src={sdkUrl} strategy="afterInteractive" onReady={() => void onSdkReady()} />
      {state.kind === "loading" ? (
        <p className="flex items-center gap-2 text-subhead text-ink-2">
          <Spinner className="text-[1.1rem]" /> Loading PayPal…
        </p>
      ) : null}
      {state.kind === "capturing" ? (
        <p className="flex items-center gap-2 text-headline">
          <Spinner className="text-[1.2rem]" /> Confirming your payment…
        </p>
      ) : null}
      {state.kind === "failed" ? (
        <div role="alert" className="flex flex-col items-center gap-2 text-center">
          <Pill tone="berry" icon={<ExclamationIcon />}>
            Can&rsquo;t pay yet
          </Pill>
          <p className="text-body text-ink-2">{state.message}</p>
          {state.restart && storeUrl ? (
            <a
              href={storeUrl}
              className="pressable focus-ring mt-2 inline-flex h-11 items-center rounded-full bg-fill-2 px-5 text-callout font-semibold text-ink hover:bg-fill-3"
            >
              Back to the store
            </a>
          ) : null}
        </div>
      ) : null}
      {state.kind === "ready" && state.message ? (
        <p role="status" className="text-center text-subhead text-ink-2">
          {state.message}
        </p>
      ) : null}
      <div className="w-full" hidden={state.kind !== "ready"}>
        <paypal-button type="pay" className="paypal-gold block w-full" onClick={pay} />
      </div>
      <p className="text-center text-footnote text-ink-3">Your payment goes straight to PayPal. Lemon Pal never sees your card.</p>
    </div>
  );
}
