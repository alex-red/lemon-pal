import { z } from "zod";
import { undoPalChange } from "@/lib/pal";
import { currentUser } from "@/lib/session";

const UndoSchema = z.object({ changeId: z.uuid() });

/** Puts back what one of Pal's changes replaced. undoPalChange checks the change is this seller's. */
export async function POST(request: Request) {
  const parsed = UndoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a change to undo." }, { status: 400 });
  const result = await undoPalChange(await currentUser(), parsed.data.changeId);
  if ("error" in result) return Response.json(result, { status: 409 });
  return Response.json(result);
}
