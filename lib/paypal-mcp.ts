import "server-only";
import { env } from "./env";
import { fromPayPalValue } from "./money";
import { paypalAccessToken } from "./paypal";

const endpoint = "https://mcp.sandbox.paypal.com/http";
const protocol = "2025-06-18";

type RpcReply<T> = { id?: number; result?: T; error?: unknown };

// Streamable HTTP can return either JSON or an event stream for a request.
async function rpcResult<T>(response: Response, id: number): Promise<T> {
  function result(reply: RpcReply<T>): T {
    if (reply.id !== id || reply.error || reply.result === undefined) throw new Error("Invalid PayPal MCP reply");
    return reply.result;
  }

  if (!response.headers.get("content-type")?.startsWith("text/event-stream")) {
    return result(await response.json());
  }

  const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();
  if (!reader) throw new Error("Missing PayPal MCP stream");
  let pending = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error("PayPal MCP stream ended before the reply");
      pending += value;
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(pending))) {
        const event = pending.slice(0, boundary.index);
        pending = pending.slice(boundary.index + boundary[0].length);
        const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        const reply = JSON.parse(data) as RpcReply<T>;
        if (reply.id === id) return result(reply);
      }
    }
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
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(8_000)]);
  const headers = new Headers({
    Authorization: `Bearer ${await paypalAccessToken(signal)}`,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  });

  async function post(message: { method: string; id?: number; params?: object }) {
    const response = await fetch(endpoint, {
      method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", ...message }),
      cache: "no-store", redirect: "error", signal,
    });
    if (!response.ok) throw new Error(`PayPal MCP HTTP ${response.status}`);
    return response;
  }

  const init = await post({ method: "initialize", id: 1, params: {
    protocolVersion: protocol, capabilities: {}, clientInfo: { name: "Lemon Pal", version: "1.0.0" },
  } });
  const session = init.headers.get("Mcp-Session-Id");
  if (session) headers.set("Mcp-Session-Id", session);
  try {
    const { protocolVersion } = await rpcResult<{ protocolVersion: string }>(init, 1);
    if (!/^2025-\d{2}-\d{2}$/.test(protocolVersion)) throw new Error("Unsupported PayPal MCP protocol");
    headers.set("MCP-Protocol-Version", protocolVersion);
    const ready = await post({ method: "notifications/initialized" });
    void ready.body?.cancel().catch(() => {});

    const reply = await post({ method: "tools/call", id: 2, params: { name: "get_order", arguments: { id: orderId } } });
    const tool = await rpcResult<{ isError?: boolean; structuredContent?: Order; content?: { type: string; text?: string }[] }>(reply, 2);
    if (tool.isError) throw new Error("PayPal MCP get_order failed");
    const order: Order = tool.structuredContent ?? JSON.parse(tool.content?.find((part) => part.type === "text")?.text ?? "null");
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
  } finally {
    if (session) {
      // Session cleanup is best effort. A failed close must not discard a successful lookup.
      await fetch(endpoint, { method: "DELETE", headers, cache: "no-store", redirect: "error", signal })
        .then((response) => response.body?.cancel()).catch(() => {});
    }
  }
}
