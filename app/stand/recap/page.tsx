import { connection } from "next/server";
import { env } from "@/lib/env";
import { RecapLoader } from "./recap-loader";

export default async function RecapPage() {
  await connection(); // read env at request time, not build time
  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <h1 className="text-2xl font-bold">Stand recap</h1>
      <div className="mt-4 min-h-[70vh] flex-1">
        <RecapLoader licenseKey={env.agStudioLicenseKey()} currency={env.currency()} />
      </div>
    </main>
  );
}
