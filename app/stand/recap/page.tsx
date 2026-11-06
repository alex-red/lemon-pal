import Link from "next/link";
import { connection } from "next/server";
import { LemonIcon, QrCodeIcon, Toolbar } from "@/components/kit";
import { env } from "@/lib/env";
import { RecapLoader } from "./recap-loader";

export default async function RecapPage() {
  await connection(); // read env at request time, not build time
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-footnote font-semibold text-ink-2">
            <LemonIcon className="text-[1.1rem]" /> Stand recap
          </p>
          <h1 className="font-display text-large-title font-semibold">What sold</h1>
        </div>
        <Toolbar aria-label="Stand">
          <Link
            href="/stand/register"
            className="pressable focus-ring inline-flex h-11 items-center gap-2 rounded-full px-5 text-callout font-semibold text-ink hover:bg-fill-2 [&_svg]:text-[1.15em]"
          >
            <QrCodeIcon /> Register
          </Link>
        </Toolbar>
      </header>
      {/* Studio fills its parent, so the parent needs a definite height, not just a minimum. */}
      <div className="h-[max(32rem,calc(100dvh-11rem))] overflow-hidden rounded-card bg-surface shadow-card ring-[0.5px] ring-hairline">
        <RecapLoader licenseKey={env.agStudioLicenseKey()} currency={env.currency()} />
      </div>
    </main>
  );
}
