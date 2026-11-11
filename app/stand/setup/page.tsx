import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageTransition } from "@/components/kit";
import { aiUnlocked } from "@/lib/ai-access";
import { sampleChoices } from "@/lib/demo";
import { env } from "@/lib/env";
import { currentStand } from "@/lib/session";
import { kindOf, switcherProps } from "@/lib/stands";
import { PalButton } from "../pal/pal";
import { StandSwitcher } from "../stand-switcher";
import { Setup } from "./setup";

export default async function SetupPage() {
  await connection(); // read env at request time, not build time
  // Every seller has a stand: the demo user starts with two. Setup edits whichever one they're on.
  const current = (await currentStand())!;
  const { stand } = current;
  // A donation stand has no items. Its page is set up in its own editor.
  if (kindOf(stand) === "donation") redirect("/stand/jar/edit");
  return (
    <PageTransition>
      <Setup
        // A catalog saved elsewhere, such as by Pal, gets new item ids. Start the editor over from it.
        key={`${stand.id}:${stand.name}:${stand.items.map((item) => item.id).join()}`}
        standId={stand.id}
        kind={kindOf(stand)}
        switcher={<StandSwitcher {...switcherProps(current)} />}
        assistant={<PalButton standId={stand.id} kind={kindOf(stand)} screen="setup" />}
        currency={env.currency()}
        standName={stand.name}
        samples={sampleChoices}
        // A published stand opens on its items, ready to update, rather than an empty setup.
        catalog={stand.publishedAt ? stand.items : []}
        aiLive={await aiUnlocked()}
      />
    </PageTransition>
  );
}
