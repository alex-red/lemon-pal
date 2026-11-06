import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AgAiConversationItem, AgAiOutputItem, AgLlmRequest, AgLlmResponse } from "ag-studio";
import { env } from "./env";

/**
 * Server half of the AG Studio agent's model adapter. Studio runs the agent loop in the browser and
 * sends each turn here, so the Anthropic key stays on the server.
 *
 * Claude Haiku 5.5 thinks by default and its `thinking` blocks must be sent back unchanged with tool
 * results. Studio's conversation items can't carry them, so each assistant turn is kept here and replayed
 * exactly on the next turn.
 *
 * Context size: the conversation lives in the browser and only grows, so every turn resends it.
 * - A prompt-cache breakpoint on the request makes each turn re-read the earlier prefix from cache.
 * - Context editing clears old tool results server-side once the prompt passes CLEAR_TRIGGER_TOKENS,
 *   keeping prompts under Haiku's 100K-token price step without changing the history we send.
 * - A request still too large for that is refused with a message to start a new chat, not truncated.
 */

const MODEL = "claude-haiku-5-5";
const CLEAR_TRIGGER_TOKENS = 50_000;
const KEEP_TOOL_USES = 6;
const CLEAR_AT_LEAST_TOKENS = 10_000; // clearing resets the cache, so only clear when it's worth it
// Rough ceiling for one request, about 150K tokens of JSON. Beyond this, start a new chat.
export const MAX_CONVERSATION_CHARS = 600_000;
type ContentBlock = Anthropic.Beta.Messages.BetaContentBlockParam;
type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;

// Assistant turns by turn id (Claude's message id). One instance, so memory is enough; a miss only loses
// thinking blocks. Studio renames items as it records them: a message takes the turn id and a tool call
// takes its call id. So turns are found by either.
const TURN_TTL_MS = 2 * 60 * 60 * 1000;
const turns = new Map<string, { content: ContentBlock[]; callIds: string[]; at: number }>();
const turnByCallId = new Map<string, string>();

function rememberTurn(id: string, content: ContentBlock[]) {
  const now = Date.now();
  for (const [key, turn] of turns) {
    if (now - turn.at <= TURN_TTL_MS) continue;
    turns.delete(key);
    turn.callIds.forEach((callId) => turnByCallId.delete(callId));
  }
  const callIds = content.flatMap((block) => (block.type === "tool_use" ? [block.id] : []));
  turns.set(id, { content, callIds, at: now });
  callIds.forEach((callId) => turnByCallId.set(callId, id));
}

function turnFor(item: AgAiConversationItem): string | undefined {
  if (item.type === "function_call") return turnByCallId.get(item.callId);
  const id = "id" in item ? item.id?.split("#")[0] : undefined;
  return id && turns.has(id) ? id : undefined;
}

function toMessages(input: AgAiConversationItem[]): MessageParam[] {
  const messages: MessageParam[] = [];
  const replayed = new Set<string>();
  const toolUseIds = new Set<string>();
  // Studio's sub-agents see only part of a turn, so a cached turn is replayed only when every call in it
  // is in this conversation with its result. Otherwise its items are rebuilt one by one.
  const answered = new Set(input.flatMap((item) => (item.type === "function_call_output" ? [item.callId] : [])));
  const present = new Set(input.flatMap((item) => (item.type === "function_call" ? [item.callId] : [])));
  const fits = (callIds: string[]) =>
    callIds.every((callId) => answered.has(callId) && present.has(callId) && !toolUseIds.has(callId));
  const push = (role: "user" | "assistant", blocks: ContentBlock[]) => {
    if (blocks.length === 0) return;
    const last = messages.at(-1);
    if (last?.role === role && Array.isArray(last.content)) last.content.push(...blocks);
    else messages.push({ role, content: [...blocks] });
  };

  for (const item of input) {
    if (item.type === "function_call_output") {
      push("user", [{ type: "tool_result", tool_use_id: item.callId, content: item.output }]);
    } else if (item.type === "message" && item.kind === "input") {
      const text = item.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
      // Studio's own notes arrive as system-role input; they're context, not the seller speaking.
      if (text) push("user", [{ type: "text", text: item.role === "system" ? `<studio_note>${text}</studio_note>` : text }]);
    } else {
      // An assistant-side item: replay its whole turn once, exactly as Claude produced it.
      const turnId = turnFor(item);
      if (turnId && (replayed.has(turnId) || fits(turns.get(turnId)!.callIds))) {
        if (!replayed.has(turnId)) {
          replayed.add(turnId);
          const { content, callIds } = turns.get(turnId)!;
          callIds.forEach((callId) => toolUseIds.add(callId));
          push("assistant", content);
        }
        continue;
      }
      // Not ours, or forgotten: rebuild what we can. Thinking blocks can't be rebuilt, so they're left out.
      if (item.type === "message") {
        const text = item.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");
        if (text) push("assistant", [{ type: "text", text }]);
      } else if (item.type === "function_call" && !toolUseIds.has(item.callId)) {
        // The API rejects a repeated tool_use id, so each call goes in once.
        toolUseIds.add(item.callId);
        push("assistant", [{ type: "tool_use", id: item.callId, name: item.name, input: safeJson(item.arguments) }]);
      }
    }
  }
  return pairToolBlocks(messages);
}

// The API needs each tool_use answered by a tool_result at the start of the next message, and each
// tool_result to answer a tool_use just before it. Drop whichever half is missing its partner.
function pairToolBlocks(messages: MessageParam[]): MessageParam[] {
  const blocks = (message: MessageParam | undefined) => (Array.isArray(message?.content) ? message.content : []);
  messages.forEach((message, i) => {
    if (!Array.isArray(message.content)) return;
    if (message.role === "assistant") {
      const results = new Set(blocks(messages[i + 1]).flatMap((b) => (b.type === "tool_result" ? [b.tool_use_id] : [])));
      message.content = message.content.filter((b) => b.type !== "tool_use" || results.has(b.id));
    } else {
      const calls = new Set(blocks(messages[i - 1]).flatMap((b) => (b.type === "tool_use" ? [b.id] : [])));
      const kept = message.content.filter((b) => {
        if (b.type !== "tool_result") return true;
        const first = calls.has(b.tool_use_id);
        calls.delete(b.tool_use_id); // one result per call
        return first;
      });
      message.content = [...kept.filter((b) => b.type === "tool_result"), ...kept.filter((b) => b.type !== "tool_result")];
    }
  });
  // Removing blocks can leave empty messages, and then two messages in a row from the same side.
  const paired: MessageParam[] = [];
  for (const message of messages) {
    if (blocks(message).length === 0) continue;
    const last = paired.at(-1);
    if (last?.role === message.role) (last.content as ContentBlock[]).push(...blocks(message));
    else paired.push(message);
  }
  return paired;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
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

  const toolChoice = !tools.length
    ? undefined
    : request.toolChoice === "none"
      ? ({ type: "none" } as const)
      : request.toolChoice === "required"
        ? ({ type: "any" } as const)
        : typeof request.toolChoice === "object"
          ? ({ type: "tool", name: request.toolChoice.name } as const)
          : ({ type: "auto" } as const);

  const response = await client.beta.messages.create(
    {
      model: MODEL,
      max_tokens: 16000,
      system: request.instructions,
      messages: toMessages(request.input),
      tools: tools.length ? tools : undefined,
      tool_choice: toolChoice,
      // Adaptive thinking at medium effort. If a replayed thinking block no longer matches the history,
      // the API drops that block instead of rejecting the request.
      thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
      output_config: {
        effort: "medium",
        ...(request.responseFormat?.type === "json"
          ? { format: { type: "json_schema" as const, schema: request.responseFormat.schema as Record<string, unknown> } }
          : {}),
      },
      // One automatic cache breakpoint at the end of the prompt. The history only grows, so each turn
      // reads the previous turn's prefix from cache.
      cache_control: { type: "ephemeral" },
      context_management: {
        edits: [
          {
            type: "clear_tool_uses_20250919",
            trigger: { type: "input_tokens", value: CLEAR_TRIGGER_TOKENS },
            keep: { type: "tool_uses", value: KEEP_TOOL_USES },
            clear_at_least: { type: "input_tokens", value: CLEAR_AT_LEAST_TOKENS },
            // The schema is what every later query is built from, so keep it.
            exclude_tools: ["view_schema"],
          },
        ],
      },
      betas: ["context-management-2025-06-27", "thinking-binding-controls-2026-08-01"],
    },
    { signal },
  );

  const cleared = response.context_management?.applied_edits.reduce(
    (n, edit) => n + ("cleared_input_tokens" in edit ? edit.cleared_input_tokens : 0),
    0,
  );
  if (cleared) console.info(`Studio assistant: context editing cleared ${cleared} tokens of old tool results`);

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
