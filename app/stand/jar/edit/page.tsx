import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageTransition } from "@/components/kit";
import { requestOrigins } from "@/lib/origins";
import { currentStand, homeOfCurrentStand } from "@/lib/session";
import { switcherProps } from "@/lib/stands";
import { store } from "@/lib/store";
import { draftDonationPage, withoutBanner } from "@/lib/storefront";
import { StandSwitcher } from "../../stand-switcher";
import { DonationEditor } from "./donation-editor";

export const metadata = { title: "Donation page · Lemon Pal" };

export default async function DonationEditorPage() {
  await connection();
  const current = await currentStand("donation");
  if (!current) redirect(await homeOfCurrentStand());
  const { stand } = current;
  const saved = await store.getStorefront(stand.id);
  const initial = saved?.donation ? saved : draftDonationPage(stand);
  const { origin, qrOrigin } = await requestOrigins();
  return (
    <PageTransition>
      <DonationEditor
        key={stand.id}
        standId={stand.id}
        switcher={<StandSwitcher {...switcherProps(current)} />}
        origin={origin}
        qrOrigin={qrOrigin}
        currency={stand.currency}
        initial={withoutBanner(initial)}
        donation={initial.donation!}
        saved={Boolean(saved?.donation)}
        demoAccount={Boolean(current.user.demo)}
      />
    </PageTransition>
  );
}
