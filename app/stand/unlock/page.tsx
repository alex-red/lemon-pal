import { cookies } from "next/headers";
import { connection } from "next/server";
import { PageTransition } from "@/components/kit";
import { env } from "@/lib/env";
import { isSellerToken, safeNextPath, SELLER_COOKIE, sellerGateOpen, sellerPasscode } from "@/lib/seller-auth";
import { Unlock } from "./unlock";

export const metadata = { title: "Seller sign-in · Lemon Pal" };

const ERRORS: Record<string, string> = {
  "paypal-canceled": "You left PayPal before signing in. Try again when you’re ready.",
  "paypal-state": "That sign-in took too long or came from somewhere else. Start again.",
  paypal: "PayPal couldn’t sign you in just now. Try again.",
  "signed-out": "That account isn’t here any more. Sign in again.",
  deleted: "That account and its stands are deleted.",
};

export default async function UnlockPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  await connection(); // read env at request time, not build time
  const { next, error } = await searchParams;
  return (
    <PageTransition>
      <Unlock
        next={safeNextPath(next)}
        demo={sellerGateOpen() ? "open" : sellerPasscode() ? "passcode" : "off"}
        passcodeRemembered={await isSellerToken((await cookies()).get(SELLER_COOKIE)?.value)}
        paypalLogin={env.paypalLogin()}
        error={error ? (ERRORS[error] ?? null) : null}
      />
    </PageTransition>
  );
}
