import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageTransition } from "@/components/kit";
import { listSellerOrders } from "@/lib/orders";
import { currentStand } from "@/lib/session";
import { standHome, switcherProps } from "@/lib/stands";
import { store } from "@/lib/store";
import { StandSwitcher } from "../stand-switcher";
import { Orders } from "./orders";

export const metadata = { title: "Online orders · Lemon Pal" };

export default async function OrdersPage() {
  await connection();
  // Orders come from an online stand's store. A seller with only local stands goes back to the register.
  const current = await currentStand("online");
  if (!current) redirect(standHome("local"));
  const { stand } = current;
  const [orders, storefront] = await Promise.all([listSellerOrders(stand.id), store.getStorefront(stand.id)]);
  return (
    <PageTransition>
      <Orders
        key={stand.id}
        standId={stand.id}
        switcher={<StandSwitcher {...switcherProps(current)} />}
        initial={orders}
        hasStore={Boolean(storefront)}
      />
    </PageTransition>
  );
}
