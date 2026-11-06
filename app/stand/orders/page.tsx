import { connection } from "next/server";
import { PageTransition } from "@/components/kit";
import { DEMO_STAND_ID } from "@/lib/demo";
import { listSellerOrders } from "@/lib/orders";
import { store } from "@/lib/store";
import { Orders } from "./orders";

export const metadata = { title: "Online orders · Lemon Pal" };

export default async function OrdersPage() {
  await connection();
  const [orders, storefront] = await Promise.all([listSellerOrders(DEMO_STAND_ID), store.getStorefront(DEMO_STAND_ID)]);
  return (
    <PageTransition>
      <Orders initial={orders} hasStore={Boolean(storefront)} />
    </PageTransition>
  );
}
