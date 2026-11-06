import { z } from "zod";
import { currentUser, rememberStand, requestStand, standNotFound, userStands } from "@/lib/session";
import { DEMO_USER_ID } from "@/lib/session-token";
import { kindOf, standHome } from "@/lib/stands";
import { store } from "@/lib/store";

const Rename = z.object({ name: z.string().trim().min(1).max(40) });

/** Renames the stand (?stand=). */
export async function PATCH(request: Request) {
  const parsed = Rename.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Give your stand a name." }, { status: 400 });
  const stand = await requestStand(request);
  if (!stand) return standNotFound();
  await store.saveStand({ ...stand, name: parsed.data.name });
  return Response.json({ id: stand.id, name: parsed.data.name });
}

/**
 * Deletes the stand (?stand=) with its sales and store, then switches to the seller's next stand. A seller keeps at
 * least one stand, and the shared demo seller's stands stay, since everyone using the demo sees them.
 */
export async function DELETE(request: Request) {
  const [user, stand] = await Promise.all([currentUser(), requestStand(request)]);
  if (!stand) return standNotFound();
  if (user.id === DEMO_USER_ID) {
    return Response.json({ error: "The demo’s stands stay put. Use Reset demo to start one over." }, { status: 403 });
  }
  const rest = (await userStands(user)).filter((s) => s.id !== stand.id);
  if (rest.length === 0) {
    return Response.json({ error: "This is your only stand. Make another before deleting it." }, { status: 409 });
  }
  await store.deleteStand(stand.id);
  const next = rest[0];
  await rememberStand(next.id);
  return Response.json({ id: next.id, home: standHome(kindOf(next)) });
}
