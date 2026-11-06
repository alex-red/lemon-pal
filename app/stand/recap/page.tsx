import Link from "next/link";
import { connection } from "next/server";
import { LinkIcon, PageTransition, QrCodeIcon, Toolbar } from "@/components/kit";
import { env } from "@/lib/env";
import { currentStand } from "@/lib/session";
import { kindOf, standHome, switcherProps } from "@/lib/stands";
import { StandSwitcher } from "../stand-switcher";
import { FirstSaleBadge, FirstSaleProvider } from "./first-sale";
import { RecapLoader } from "./recap-loader";
import { ResetDemo } from "./reset-demo";

export default async function RecapPage() {
  await connection(); // read env at request time, not build time
  const current = (await currentStand())!;
  const { stand } = current;
  const kind = kindOf(stand);
  return (
    <PageTransition>
      <FirstSaleProvider>
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-3 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-8 short:gap-3 short:pt-3">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <StandSwitcher {...switcherProps(current)} />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h1 className="font-display text-large-title font-semibold">Sales desk</h1>
                <FirstSaleBadge />
              </div>
              <p className="mt-1 text-subhead text-ink-2">See what sold and find the payments behind it.</p>
            </div>
            <Toolbar aria-label="Stand">
              <Link
                href={standHome(kind)}
                transitionTypes={["nav-back"]}
                // Narrow phones: no icon, so both actions fit in a 320px screen's 280px column.
                className="pressable focus-ring inline-flex h-11 items-center gap-2 rounded-full px-5 text-callout max-[24rem]:[&_svg]:hidden font-semibold text-ink hover:bg-fill-2 [&_svg]:text-[1.15em]"
              >
                {kind === "online" ? (
                  <>
                    <LinkIcon /> Store
                  </>
                ) : (
                  <>
                    <QrCodeIcon /> Register
                  </>
                )}
              </Link>
              <ResetDemo standId={stand.id} kind={kind} />
            </Toolbar>
          </header>
          {/* Studio fills its parent, so the parent needs a definite height, not just a minimum. */}
          <div className="h-[max(33rem,calc(100dvh-12rem))] overflow-hidden rounded-card bg-surface shadow-card ring-[0.5px] ring-hairline">
            {/* Keyed by stand, so switching stands starts Studio over on the other stand's sales. */}
            <RecapLoader key={stand.id} licenseKey={env.agStudioLicenseKey()} currency={env.currency()} standId={stand.id} />
          </div>
        </main>
      </FirstSaleProvider>
    </PageTransition>
  );
}
