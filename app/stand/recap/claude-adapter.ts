import type { AgAiEvent, AgLlmAdapter, AgLlmResponse } from "ag-studio";

/**
 * Browser half of the AG Studio agent's model adapter. Each turn goes to our own server route, which
 * calls Claude with the server-held key. The route answers with the whole turn, so the stream replays
 * that turn as events once it arrives.
 */
export const claudeAdapter: AgLlmAdapter = {
  executeTurn(request, options) {
    const complete: Promise<AgLlmResponse> = fetch("/api/studio/llm", {
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
      }));

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
