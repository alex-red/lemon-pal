import { connection } from "next/server";
import { getOrCreateDemoStand } from "@/lib/demo";
import { Register } from "./register";

export default async function RegisterPage() {
  await connection();
  const stand = await getOrCreateDemoStand();
  return <Register standName={stand.name} currency={stand.currency} items={stand.items} />;
}
