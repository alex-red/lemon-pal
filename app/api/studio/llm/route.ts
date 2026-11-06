import Anthropic from "@anthropic-ai/sdk";
import type { AgLlmRequest } from "ag-studio";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { runStudioTurn } from "@/lib/studio-llm";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
// One question can take several turns (look at the schema, add a widget, configure it).
const allow = createRateLimiter({ limit: 120, windowMs: 60 * 60 * 1000 });

// One turn of the AG Studio agent: the browser sends Studio's request, the server calls Claude.
export async function POST(request: Request) {
  if (!allow(clientKey(request))) {
    return Response.json({ error: "The assistant is busy. Try again in a while." }, { status: 429 });
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return Response.json({ error: "Conversation is too long." }, { status: 413 });

  let body: AgLlmRequest;
  try {
    body = JSON.parse(text) as AgLlmRequest;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!Array.isArray(body?.input)) return Response.json({ error: "Invalid request." }, { status: 400 });

  try {
    return Response.json(await runStudioTurn(body, request.signal));
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "The assistant is busy. Try again shortly." }, { status: 429 });
    }
    console.error("Studio assistant turn failed", error);
    return Response.json({ error: "The assistant couldn't answer right now." }, { status: 502 });
  }
}
