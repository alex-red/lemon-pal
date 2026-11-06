import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageTransition } from "@/components/kit";
import { env } from "@/lib/env";
import { payOrigin } from "@/lib/lan";
import { currentStand } from "@/lib/session";
import { standHome, switcherProps } from "@/lib/stands";
import { StandSwitcher } from "../stand-switcher";
import { Register } from "./register";

export default async function RegisterPage() {
  await connection();
  // The register runs a local stand. A seller with only online stands goes to their store instead.
  const current = await currentStand("local");
  if (!current) redirect(standHome("online"));
  const { stand } = current;
  const origin = payOrigin((await headers()).get("host"), env.publicAppUrl());
  return (
    <PageTransition>
      <Register
        key={stand.id}
        standId={stand.id}
        currency={stand.currency}
        items={stand.items}
        payOrigin={origin}
        switcher={<StandSwitcher {...switcherProps(current)} variant="title" />}
      />
    </PageTransition>
  );
}
