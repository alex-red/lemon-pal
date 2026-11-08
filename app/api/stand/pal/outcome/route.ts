import { z } from "zod";
import { notePalOutcome } from "@/lib/pal";
import { currentUser } from "@/lib/session";

const Body = z.object({ proposalId: z.uuid(), outcome: z.enum(["done", "declined", "failed"]) });

/**
 * Tells Pal how one of its proposals ended. The action itself already ran (or didn't) through its own route, from the
 * seller's tap. This only keeps Pal's chat in step.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Say how it went." }, { status: 400 });
  const user = await currentUser();
  if (!notePalOutcome(user, parsed.data.proposalId, parsed.data.outcome)) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
