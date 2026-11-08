import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageTransition } from "@/components/kit";
import { listSellerOrders } from "@/lib/orders";
import { currentStand, homeOfCurrentStand } from "@/lib/session";
import { switcherProps } from "@/lib/stands";
import { store } from "@/lib/store";
import { PalButton } from "../pal/pal";
import { StandSwitcher } from "../stand-switcher";
import { Orders } from "./orders";

export const metadata = { title: "Online orders · Lemon Pal" };

export default async function OrdersPage() {
  await connection();
  // Orders come from an online stand's store. A seller without one goes to the home of the stand they're on.
  const current = await currentStand("online");
  if (!current) redirect(await homeOfCurrentStand());
  const { stand } = current;
  const [orders, storefront] = await Promise.all([listSellerOrders(stand.id), store.getStorefront(stand.id)]);
  return (
    <PageTransition>
      <Orders
        key={stand.id}
        standId={stand.id}
        switcher={<StandSwitcher {...switcherProps(current)} />}
        assistant={<PalButton standId={stand.id} kind="online" screen="orders" />}
        initial={orders}
        hasStore={Boolean(storefront)}
      />
    </PageTransition>
  );
}
