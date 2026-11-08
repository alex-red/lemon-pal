import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageTransition } from "@/components/kit";
import { requestOrigins } from "@/lib/origins";
import { currentStand, homeOfCurrentStand } from "@/lib/session";
import { switcherProps } from "@/lib/stands";
import { store } from "@/lib/store";
import { bannerUrl } from "@/lib/storefront";
import { PalButton } from "../pal/pal";
import { StandSwitcher } from "../stand-switcher";
import { DonationDisplay } from "./display";

export const metadata = { title: "Donation display · Lemon Pal" };

// The donation stand's home: its poster with one QR code, for a propped-up tablet or a printout.
export default async function DonationDisplayPage() {
  await connection();
  const current = await currentStand("donation");
  if (!current) redirect(await homeOfCurrentStand());
  const { stand } = current;
  const storefront = await store.getStorefront(stand.id);
  // No page yet means no address for the code. Set one up first.
  if (!storefront?.donation) redirect("/stand/jar/edit");
  const { qrOrigin } = await requestOrigins();
  return (
    <PageTransition>
      <DonationDisplay
        key={stand.id}
        standId={stand.id}
        switcher={<StandSwitcher {...switcherProps(current)} />}
        assistant={<PalButton standId={stand.id} kind="donation" screen="jar" />}
        currency={stand.currency}
        pageUrl={`${qrOrigin}/${storefront.slug}`}
        payOrigin={qrOrigin}
        title={storefront.title}
        intro={storefront.intro}
        bannerUrl={bannerUrl(storefront)}
        accent={storefront.accent}
        open={storefront.open}
        buttonLabel={storefront.donation.buttonLabel}
        showNotes={storefront.donation.showNotes}
        demoAccount={Boolean(current.user.demo)}
      />
    </PageTransition>
  );
}
