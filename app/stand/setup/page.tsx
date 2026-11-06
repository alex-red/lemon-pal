import { connection } from "next/server";
import { getOrCreateDemoStand, sampleChoices } from "@/lib/demo";
import { env } from "@/lib/env";
import { Setup } from "./setup";

export default async function SetupPage() {
  await connection(); // read env at request time, not build time
  const stand = await getOrCreateDemoStand();
  return <Setup currency={env.currency()} standName={stand.name} samples={sampleChoices} />;
}
