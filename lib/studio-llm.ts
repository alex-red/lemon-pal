import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AgAiConversationItem, AgAiOutputItem, AgLlmRequest, AgLlmResponse } from "ag-studio";
import { env } from "./env";

/**
 * Server half of the AG Studio agent's model adapter. Studio runs the agent loop in the browser and
 * sends each turn here, so the Anthropic key stays on the server.
 *
 * Claude Sonnet 5.5 returns `thinking` blocks during tool loops (even at the lowest setting) and they
 * must be sent back unchanged. Studio's conversation items can't carry them, so each assistant turn is
 * kept here, keyed by the item ids we give Studio, and replayed exactly on the next turn.
 */

const MODEL = "claude-sonnet-5-5";
type ContentBlock = Anthropic.Beta.Messages.BetaContentBlockParam;
type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;

// Assistant turns by turn id. One instance, so memory is enough; a miss only loses thinking blocks.
const TURN_TTL_MS = 2 * 60 * 60 * 1000;
const turns = new Map<string, { content: ContentBlock[]; at: number }>();

function rememberTurn(id: string, content: ContentBlock[]) {
  const now = Date.now();
  for (const [key, turn] of turns) if (now - turn.at > TURN_TTL_MS) turns.delete(key);
  turns.set(id, { content, at: now });
}

// Item ids look like "<turn id>#<index>", so any item tells us which assistant turn it came from.
const turnOf = (itemId: string | undefined) => itemId?.split("#")[0];

function toMessages(input: AgAiConversationItem[]): MessageParam[] {
  const messages: MessageParam[] = [];
  const push = (role: "user" | "assistant", blocks: ContentBlock[]) => {
    if (blocks.length === 0) return;
    const last = messages.at(-1);
    if (last?.role === role && Array.isArray(last.content)) last.content.push(...blocks);
    else messages.push({ role, content: [...blocks] });
  };

  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    if (item.type === "function_call_output") {
      push("user", [{ type: "tool_result", tool_use_id: item.callId, content: item.output }]);
    } else if (item.type === "message" && item.kind === "input") {
      const text = item.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
      // Studio's own notes arrive as system-role input; they're context, not the seller speaking.
      if (text) push("user", [{ type: "text", text: item.role === "system" ? `<studio_note>${text}</studio_note>` : text }]);
    } else {
      // An assistant-side item: replay its whole turn once, exactly as Claude produced it.
      const turnId = turnOf(item.id);
      const cached = turnId ? turns.get(turnId) : undefined;
      if (cached) {
        push("assistant", cached.content);
        while (i + 1 < input.length && input[i + 1].type !== "function_call_output" && input[i + 1].kind !== "input" && turnOf(input[i + 1].id) === turnId) i++;
        continue;
      }
      // Not ours, or forgotten: rebuild what we can. Thinking blocks can't be rebuilt, so they're left out.
      if (item.type === "message") {
        const text = item.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");
        if (text) push("assistant", [{ type: "text", text }]);
      } else if (item.type === "function_call") {
        push("assistant", [{ type: "tool_use", id: item.callId, name: item.name, input: safeJson(item.arguments) }]);
      }
    }
  }
  return messages;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function stripThinking(messages: MessageParam[]): MessageParam[] {
  return messages.map((m) =>
    m.role === "assistant" && Array.isArray(m.content)
      ? { ...m, content: m.content.filter((b) => b.type !== "thinking" && b.type !== "redacted_thinking") }
      : m,
  );
}

let client: Anthropic | null = null;

export async function runStudioTurn(request: AgLlmRequest, signal?: AbortSignal): Promise<AgLlmResponse> {
  client ??= new Anthropic({ apiKey: env.anthropicApiKey() });

  const tools = (request.tools ?? [])
    .filter((tool) => tool.kind !== "provided")
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Beta.Messages.BetaTool.InputSchema,
    }));

  const body = (messages: MessageParam[]) => ({
    model: MODEL,
    max_tokens: 16000,
    system: request.instructions,
    messages,
    tools: tools.length ? tools : undefined,
    // Forced tool choice isn't available on this model, so "required" falls back to auto.
    tool_choice: tools.length ? { type: request.toolChoice === "none" ? ("none" as const) : ("auto" as const) } : undefined,
    // The lowest thinking setting. It still returns short progress notes between tool calls.
    thinking: { type: "between_tools" } as unknown as Anthropic.Beta.Messages.BetaThinkingConfigParam,
    output_config: {
      effort: "medium" as const,
      ...(request.responseFormat?.type === "json"
        ? { format: { type: "json_schema" as const, schema: request.responseFormat.schema as Record<string, unknown> } }
        : {}),
    },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
  });

  const messages = toMessages(request.input);
  let response: Anthropic.Beta.Messages.BetaMessage;
  try {
    response = await client.beta.messages.create(body(messages), { signal });
  } catch (error) {
    // If history was edited after a thinking block was produced, the API rejects the replay. Retry without them.
    if (error instanceof Anthropic.BadRequestError && /thinking/i.test(error.message)) {
      response = await client.beta.messages.create(body(stripThinking(messages)), { signal });
    } else {
      throw error;
    }
  }

  rememberTurn(response.id, response.content as ContentBlock[]);

  const output: AgAiOutputItem[] = [];
  response.content.forEach((block, index) => {
    const id = `${response.id}#${index}`;
    if (block.type === "text" && block.text) {
      output.push({
        id,
        kind: "output",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "text", text: block.text, annotations: [] }],
      });
    } else if (block.type === "tool_use") {
      output.push({
        id,
        kind: "output",
        type: "function_call",
        callId: block.id,
        name: block.name,
        arguments: JSON.stringify(block.input ?? {}),
        status: "completed",
      });
    } else if (block.type === "thinking" && block.thinking) {
      output.push({ id, kind: "output", type: "reasoning", summary: [{ type: "summary", text: block.thinking }] });
    }
  });

  const refused = response.stop_reason === "refusal";
  return {
    id: response.id,
    createdAt: Date.now(),
    model: response.model,
    status: refused ? "failed" : response.stop_reason === "max_tokens" ? "incomplete" : "completed",
    ...(refused ? { error: { code: "refusal", message: "The assistant declined this request." } } : {}),
    ...(response.stop_reason === "max_tokens" ? { incompleteDetails: { reason: "max_output_tokens" as const } } : {}),
    output,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cachedInputTokens: response.usage.cache_read_input_tokens ?? undefined,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? undefined,
    },
  };
}
