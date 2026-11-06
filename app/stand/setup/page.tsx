import { connection } from "next/server";
import { env } from "@/lib/env";
import { Setup } from "./setup";

export default async function SetupPage() {
  await connection(); // read env at request time, not build time
  return <Setup currency={env.currency()} />;
}
