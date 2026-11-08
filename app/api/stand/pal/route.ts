import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { PalBusyError, PalChatFullError, runPalTurn } from "@/lib/pal";
import { PAL_SCREENS, type PalEvent } from "@/lib/pal-events";
import { createRateLimiter } from "@/lib/rate-limit";
import { kindOf } from "@/lib/stands";
import { currentUser, requestStand, standNotFound } from "@/lib/session";

// A message can take several model turns (read the stand, change it, answer), so this counts messages, not turns.
const allow = createRateLimiter({ limit: 60, windowMs: 60 * 60 * 1000 });
// Each sign photo is a vision read on top of the turn, so photos get the sign screen's own hourly allowance.
const allowPhoto = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });

const JPEG = "data:image/jpeg;base64,";

const MessageSchema = z.object({
  chatId: z.uuid(),
  message: z.string().trim().min(1).max(2000),
  // A sign photo the browser shrank to a JPEG, well under the model's 5 MB image limit.
  photo: z
    .string()
    .max(4_000_000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
    .optional(),
  screen: z.enum(PAL_SCREENS).catch("other"),
  /** Whether the screen is big enough for Booth Analyst, the recap's charting assistant. */
  analyst: z.boolean().catch(true),
  timeZone: z
    .string()
    .max(64)
    .refine((zone) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: zone });
        return true;
      } catch {
        return false;
      }
    })
    .catch("UTC"),
});

/**
 * One message to Pal, the stand assistant, for the stand on screen (?stand=). Answers with an NDJSON stream of
 * PalEvents: what Pal is doing, its answer as it arrives, and any change it made.
 */
export async function POST(request: Request) {
  const parsed = MessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Type a message for Pal." }, { status: 400 });
  const [user, stand] = await Promise.all([currentUser(), requestStand(request)]);
  if (!stand) return standNotFound();
  if (!allow(user.id)) return Response.json({ error: "Pal needs a breather. Try again in a while." }, { status: 429 });
  if (parsed.data.photo) {
    if (kindOf(stand) === "donation") return Response.json({ error: "A donation stand has no items to read from a sign." }, { status: 400 });
    if (!allowPhoto(user.id)) return Response.json({ error: "Too many sign photos this hour. Try again later." }, { status: 429 });
  }

  const { chatId, message, screen, analyst, timeZone, photo } = parsed.data;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: PalEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The seller closed the chat. The turn still finishes, so Pal remembers its own reply.
        }
      };
      try {
        // Not the request's signal: a change Pal starts should finish and be remembered even if the seller looks away.
        await runPalTurn({ chatId, user, stand, screen, analyst, timeZone, text: message, photo: photo?.slice(JPEG.length), emit, signal: AbortSignal.timeout(90_000) });
      } catch (error) {
        if (error instanceof PalBusyError) emit({ type: "error", message: "Pal is still answering your last message." });
        else if (error instanceof PalChatFullError) emit({ type: "error", message: "This chat has grown long. Start a new chat to keep going." });
        else if (error instanceof Anthropic.RateLimitError) emit({ type: "error", message: "Pal is busy. Try again shortly." });
        else {
          console.error("Pal turn failed", error);
          emit({ type: "error", message: "Pal couldn't answer right now. Try again." });
        }
      }
      emit({ type: "done" });
      try {
        controller.close();
      } catch {
        // Already closed by the browser.
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
