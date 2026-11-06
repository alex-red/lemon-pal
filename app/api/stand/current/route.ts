import { z } from "zod";
import { currentUser, rememberStand } from "@/lib/session";
import { kindOf, standHome } from "@/lib/stands";
import { store } from "@/lib/store";

const Body = z.object({ standId: z.string().min(1).max(100) });

/** Remembers which stand the seller is working on, so the stand pages open it. Returns where that stand's home is. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a stand." }, { status: 400 });
  const [user, stand] = await Promise.all([currentUser(), store.getStand(parsed.data.standId)]);
  if (!stand || stand.ownerId !== user.id) return Response.json({ error: "That stand isn’t yours." }, { status: 404 });
  await rememberStand(stand.id);
  return Response.json({ id: stand.id, home: standHome(kindOf(stand)) });
}
