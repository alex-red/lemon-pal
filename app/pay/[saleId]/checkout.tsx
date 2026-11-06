"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import type { PayPalOneTimePaymentSession } from "@/types/paypal-web-sdk";

type Props = { saleId: string; clientId: string; sdkUrl: string; currency: string };

type State =
  | { kind: "loading" }
  | { kind: "ready"; message?: string }
  | { kind: "capturing" }
  | { kind: "paid" }
  | { kind: "failed"; message: string };

async function postJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "POST" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export function Checkout({ saleId, clientId, sdkUrl, currency }: Props) {
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
    return <p className="mt-8 text-center text-3xl font-bold text-leaf">🍋 Paid. Thank you!</p>;
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <Script src={sdkUrl} strategy="afterInteractive" onReady={() => void onSdkReady()} />
      {state.kind === "loading" ? <p className="opacity-60">Loading PayPal…</p> : null}
      {state.kind === "capturing" ? <p className="font-semibold">Confirming your payment…</p> : null}
      {state.kind === "failed" ? <p className="text-red-600">{state.message}</p> : null}
      {state.kind === "ready" && state.message ? <p className="text-center">{state.message}</p> : null}
      <paypal-button type="pay" className="paypal-gold" hidden={state.kind !== "ready"} onClick={pay} />
    </div>
  );
}
