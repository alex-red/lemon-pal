import { headers } from "next/headers";
import { connection } from "next/server";
import { getOrCreateDemoStand } from "@/lib/demo";
import { env } from "@/lib/env";
import { payOrigin } from "@/lib/lan";
import { Register } from "./register";

export default async function RegisterPage() {
  await connection();
  const stand = await getOrCreateDemoStand();
  const origin = payOrigin((await headers()).get("host"), env.publicAppUrl());
  return <Register standName={stand.name} currency={stand.currency} items={stand.items} payOrigin={origin} />;
}
