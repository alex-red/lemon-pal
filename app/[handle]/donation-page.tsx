import Link from "next/link";
import { GoalBar, LemonIcon, PageTransition, StorefrontHeader } from "@/components/kit";
import { raisedCents } from "@/lib/donations";
import { store } from "@/lib/store";
import { bannerUrl } from "@/lib/storefront";
import type { Stand, Storefront } from "@/lib/types";
import { DonateForm } from "./donate-form";
import { PreviewBar } from "./preview-bar";

/**
 * A donation stand's public page, where the poster's QR code leads. It shows the seller's photo, title and message,
 * the goal if there is one, and the amount picker. Only totals are shown here, never a donor's name or note.
 */
export async function DonationPage({ storefront, stand, previewing }: { storefront: Storefront; stand: Stand; previewing: boolean }) {
  const settings = storefront.donation!;
  const open = storefront.open;
  const raised = settings.goalCents ? raisedCents(await store.listSales(stand.id)) : null;

  return (
    <PageTransition>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-8">
        {previewing ? <PreviewBar open={open} donation /> : null}
        <StorefrontHeader
          title={storefront.title}
          intro={storefront.intro}
          bannerUrl={bannerUrl(storefront)}
          accent={storefront.accent}
          closed={!open}
        />
        {settings.goalCents && raised ? (
          <GoalBar raisedCents={raised.cents} goalCents={settings.goalCents} currency={stand.currency} className="px-1" />
        ) : null}
        <DonateForm
          handle={storefront.slug}
          currency={stand.currency}
          presetsCents={settings.presetsCents}
          allowCustom={settings.allowCustom}
          minCents={settings.minCents}
          maxCents={settings.maxCents}
          buttonLabel={settings.buttonLabel}
          notes={settings.notes}
          open={open}
          preview={previewing}
        />
        <footer className="mt-6 flex justify-center">
          <Link href="/" className="focus-ring inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-footnote text-ink-2 hover:bg-fill">
            <LemonIcon className="text-[1.1em]" /> Made with Lemon Pal
          </Link>
        </footer>
      </main>
    </PageTransition>
  );
}
