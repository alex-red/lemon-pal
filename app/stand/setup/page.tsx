import { connection } from "next/server";
import { PageTransition } from "@/components/kit";
import { sampleChoices } from "@/lib/demo";
import { env } from "@/lib/env";
import { currentStand } from "@/lib/session";
import { kindOf, switcherProps } from "@/lib/stands";
import { StandSwitcher } from "../stand-switcher";
import { Setup } from "./setup";

export default async function SetupPage() {
  await connection(); // read env at request time, not build time
  // Every seller has a stand: the demo user starts with two. Setup edits whichever one they're on.
  const current = (await currentStand())!;
  const { stand } = current;
  return (
    <PageTransition>
      <Setup
        key={stand.id}
        standId={stand.id}
        kind={kindOf(stand)}
        switcher={<StandSwitcher {...switcherProps(current)} />}
        currency={env.currency()}
        standName={stand.name}
        samples={sampleChoices}
      />
    </PageTransition>
  );
}
