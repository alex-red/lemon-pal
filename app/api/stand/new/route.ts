import { z } from "zod";
import { env } from "@/lib/env";
import { currentUser, rememberStand, userStands } from "@/lib/session";
import { store } from "@/lib/store";
import type { Stand } from "@/lib/types";

const Body = z.object({
  kind: z.enum(["local", "online"]),
  name: z.string().trim().min(1).max(40),
});

/** A seller can run a handful of stands. Enough for a market season, not a marketplace. */
const MAX_STANDS = 12;

/** Creates an empty stand and switches to it. The seller fills its catalog on the setup screen next. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Give your stand a name." }, { status: 400 });
  const user = await currentUser();
  if ((await userStands(user)).length >= MAX_STANDS) {
    return Response.json({ error: `You can have up to ${MAX_STANDS} stands.` }, { status: 409 });
  }
  const stand: Stand = {
    id: crypto.randomUUID(),
    ownerId: user.id,
    kind: parsed.data.kind,
    name: parsed.data.name,
    currency: env.currency(),
    items: [],
    publishedAt: null,
  };
  await store.saveStand(stand);
  await rememberStand(stand.id);
  return Response.json({ id: stand.id, next: "/stand/setup" }, { status: 201 });
}
