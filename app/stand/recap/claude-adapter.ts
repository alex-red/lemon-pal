import type { AgAiEvent, AgLlmAdapter, AgLlmResponse } from "ag-studio";

/*
 * Whether Claude is working on a turn, for the assistant's glow. A tool loop sends several turns in a row, so
 * "done" waits a beat before it's reported, and the glow doesn't blink off between them.
 */
let turnsInFlight = 0;
let thinking = false;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function setThinking(next: boolean) {
  if (thinking === next) return;
  thinking = next;
  listeners.forEach((listener) => listener());
}

function turnStarted() {
  turnsInFlight++;
  clearTimeout(settleTimer);
  setThinking(true);
}

function turnEnded() {
  turnsInFlight = Math.max(0, turnsInFlight - 1);
  if (turnsInFlight === 0) settleTimer = setTimeout(() => setThinking(false), 600);
}

export function subscribeThinking(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const isThinking = () => thinking;

/**
 * Browser half of the AG Studio agent's model adapter. Each turn goes to our own server route, which
 * calls Claude with the server-held key. The route answers with the whole turn, so the stream replays
 * that turn as events once it arrives.
 */
export const claudeAdapter: AgLlmAdapter = {
  executeTurn(request, options) {
    turnStarted();
    const complete: Promise<AgLlmResponse> = fetch("/api/stand/studio/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: options?.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `Assistant request failed (${res.status})`);
        return json as AgLlmResponse;
      })
      .catch((error: Error): AgLlmResponse => ({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        status: options?.signal?.aborted ? "cancelled" : "failed",
        error: { code: "request_failed", message: error.message },
        output: [],
      }))
      .finally(turnEnded);

    async function* events(): AsyncGenerator<AgAiEvent> {
      const response = await complete;
      for (const item of response.output) {
        if (item.type === "reasoning") {
          const delta = item.summary.map((s) => s.text).join("\n");
          if (delta) yield { type: "REASONING_MESSAGE_CHUNK", messageId: item.id, role: "reasoning", delta };
        } else if (item.type === "message") {
          const delta = item.content.map((c) => (c.type === "text" ? c.text : c.refusal)).join("");
          if (delta) yield { type: "TEXT_MESSAGE_CHUNK", messageId: item.id, role: "assistant", delta };
        } else if (item.type === "function_call") {
          yield { type: "TOOL_CALL_CHUNK", toolCallId: item.callId, toolCallName: item.name, delta: item.arguments };
        }
      }
    }

    return { stream: { [Symbol.asyncIterator]: events }, complete };
  },
};
