import "server-only";
import { env } from "./env";
import { fromPayPalValue } from "./money";
import { paypalAccessToken } from "./paypal";

// PayPal's docs list a Streamable HTTP path (/http), but the Sandbox server answers only the SSE transport: a GET on
// /sse opens the event stream and names a message URL, requests are POSTed there, and replies arrive on the stream.
const origin = "https://mcp.sandbox.paypal.com";
const protocol = "2025-06-18";

type RpcReply = { id?: number; result?: unknown; error?: unknown };
type ToolReply = { isError?: boolean; structuredContent?: unknown; content?: { type: string; text?: string }[] };

/** Opens one MCP session over SSE, runs `work` with a tool caller, then closes the stream. */
async function withPayPalMcp<T>(signal: AbortSignal, work: (call: (name: string, args: object) => Promise<unknown>) => Promise<T>): Promise<T> {
  const auth = `Bearer ${await paypalAccessToken(signal)}`;
  const stream = await fetch(`${origin}/sse`, {
    headers: { Authorization: auth, Accept: "text/event-stream" }, cache: "no-store", redirect: "error", signal,
  });
  if (!stream.ok || !stream.body) throw new Error(`PayPal MCP HTTP ${stream.status}`);
  const reader = stream.body.pipeThrough(new TextDecoderStream()).getReader();

  let messageUrl: string | null = null;
  const replies = new Map<number, RpcReply>();
  let pending = "";
  // Reads events until `ready` is satisfied. Only one read loop runs at a time, because requests go one by one.
  async function readUntil(ready: () => boolean) {
    while (!ready()) {
      const { value, done } = await reader.read();
      if (done) throw new Error("PayPal MCP stream ended before the reply");
      pending += value;
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(pending))) {
        const event = pending.slice(0, boundary.index);
        pending = pending.slice(boundary.index + boundary[0].length);
        const type = /^event:\s*(.*)$/m.exec(event)?.[1]?.trim();
        const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        if (type === "endpoint") {
          const url = new URL(data, origin);
          if (url.origin !== origin) throw new Error("PayPal MCP named another host");
          messageUrl = url.href;
        } else {
          try {
            const reply = JSON.parse(data) as RpcReply;
            if (typeof reply.id === "number") replies.set(reply.id, reply);
          } catch {
            // A non-JSON event isn't a reply to us.
          }
        }
      }
    }
  }

  let nextId = 1;
  async function send(method: string, params?: object, expectReply = true) {
    const id = expectReply ? nextId++ : undefined;
    const response = await fetch(messageUrl!, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, ...(params ? { params } : {}), ...(id ? { id } : {}) }),
      cache: "no-store", redirect: "error", signal,
    });
    void response.body?.cancel().catch(() => {});
    if (!response.ok) throw new Error(`PayPal MCP HTTP ${response.status}`);
    if (!id) return undefined;
    await readUntil(() => replies.has(id));
    const reply = replies.get(id)!;
    if (reply.error || reply.result === undefined) throw new Error("PayPal MCP returned an error");
    return reply.result;
  }

  try {
    await readUntil(() => messageUrl !== null);
    const init = (await send("initialize", {
      protocolVersion: protocol, capabilities: {}, clientInfo: { name: "Lemon Pal", version: "1.0.0" },
    })) as { protocolVersion?: string };
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(init.protocolVersion ?? "")) throw new Error("Unsupported PayPal MCP protocol");
    await send("notifications/initialized", undefined, false);
    return await work(async (name, args) => {
      const tool = (await send("tools/call", { name, arguments: args })) as ToolReply;
      if (tool.isError) throw new Error(`PayPal MCP ${name} failed`);
      const body = tool.structuredContent ?? JSON.parse(tool.content?.find((part) => part.type === "text")?.text ?? "null");
      // The server reports PayPal API errors inside a normal reply, as { ok: false, ... } or { error: ... }.
      if (!body || typeof body !== "object" || ("ok" in body && body.ok === false) || "error" in body) {
        throw new Error(`PayPal MCP ${name} failed`);
      }
      return body;
    });
  } finally {
    void reader.cancel().catch(() => {});
  }
}

type Amount = { value?: string; currency_code?: string };
type Capture = {
  id?: string;
  status?: string;
  amount?: Amount;
  seller_receivable_breakdown?: { paypal_fee?: Amount; net_amount?: Amount };
};
type Order = { id?: string; purchase_units?: { payments?: { captures?: Capture[] } }[] };

function amountInCents(amount: Amount | undefined, currency: string) {
  if (amount?.currency_code !== currency || typeof amount.value !== "string") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(amount.value)) return null;
  const cents = fromPayPalValue(amount.value);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Call exactly one read-only Sandbox tool and project the response to payment fields. */
export async function readPayPalReceipt(orderId: string, captureId: string, requestSignal: AbortSignal) {
  if (!env.paypalReceiptCheck()) throw new Error("PayPal receipt lookup is disabled");
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(10_000)]);
  const order = (await withPayPalMcp(signal, (call) => call("get_order", { id: orderId }))) as Order;
  if (order?.id !== orderId) throw new Error("PayPal MCP returned a different order");
  const capture = order.purchase_units?.flatMap((unit) => unit.payments?.captures ?? []).find((entry) => entry.id === captureId);
  const currency = capture?.amount?.currency_code;
  if (!capture || !currency || !/^[A-Z]{3}$/.test(currency)) throw new Error("PayPal MCP did not return the recorded capture");
  const capturedCents = amountInCents(capture.amount, currency);
  if (capturedCents === null) throw new Error("PayPal MCP did not return a valid capture amount");
  const status = capture.status ?? "";

  return {
    currency,
    capturedCents,
    captureStatus: ["COMPLETED", "DECLINED", "PARTIALLY_REFUNDED", "PENDING", "REFUNDED", "FAILED"].includes(status) ? status : null,
    feeCents: amountInCents(capture.seller_receivable_breakdown?.paypal_fee, currency),
    netAtCaptureCents: amountInCents(capture.seller_receivable_breakdown?.net_amount, currency),
  };
}
