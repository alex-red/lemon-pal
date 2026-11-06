import { headers } from "next/headers";
import { connection } from "next/server";
import { PageTransition } from "@/components/kit";
import { getOrCreateDemoStand } from "@/lib/demo";
import { env } from "@/lib/env";
import { store } from "@/lib/store";
import { draftStorefront, withoutBanner } from "@/lib/storefront";
import { StoreEditor } from "./store-editor";

export const metadata = { title: "Online store · Lemon Pal" };

export default async function StoreSettingsPage() {
  await connection();
  const stand = await getOrCreateDemoStand();
  const saved = await store.getStorefront(stand.id);
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  // The address buyers will type, shown in front of the handle field and put in the share code.
  const origin = env.publicAppUrl()?.replace(/\/$/, "") ?? (host ? `${proto}://${host}` : "");

  return (
    <PageTransition>
      <StoreEditor
        origin={origin}
        currency={stand.currency}
        published={Boolean(stand.publishedAt)}
        initial={withoutBanner(saved ?? draftStorefront(stand))}
        saved={Boolean(saved)}
        items={stand.items.map((item) => ({
          id: item.id,
          name: item.name,
          priceCents: item.priceCents,
          emoji: item.emoji,
          image: item.image,
          online: item.online !== false,
          ships: item.ships === true,
        }))}
      />
    </PageTransition>
  );
}
