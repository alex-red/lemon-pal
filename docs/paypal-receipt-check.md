# Booth Analyst and PayPal's MCP server

**Status** · Behind `PAYPAL_MCP_RECEIPT_CHECK=1`. The MCP client was checked against the live Sandbox server on November 7, 2026 with a fresh Sandbox order: `get_order` returns it, and a missing order or capture is reported as a failed lookup. On the same day a $10.00 register sale was paid with the Sandbox buyer on a local build, and **Check my latest sale** reported the capture as COMPLETED, matching the receipt, with a $0.84 fee and $9.16 net, the same as PayPal's Captures API. Rehearse it once more on the hosted build before turning the flag on for judges.

Booth Analyst has two PayPal tools, plus `look_up_receipt`, which reads a receipt's status and items as Lemon Pal recorded them so it can tell whether a refund went through:

- **Check a receipt** (`check_paypal_receipt`) reads a receipt's capture, fee and net at capture from PayPal's hosted MCP server. The seller names a receipt (“check #3F2A9C1B”, “check my latest sale”) or selects one in Recent sales.
- **Start a refund** (`start_refund`) opens a paid receipt at its refund confirmation. It refunds nothing. The seller reads the amount and taps **Yes, refund it**, and the refund goes through the existing refund route with its `PayPal-Request-Id`. This tool works without the flag, and for demo receipts the refund stays local. Checked on a local demo account on November 7, 2026: the confirmation opened for the named receipt, the receipt flipped to Refunded only after the tap, and asking again got “already refunded” instead of a second refund.

## Try it

1. Use the Lemon Pal Sandbox REST app credentials in `.env.local`. Set `PAYPAL_ENV=sandbox` and `PAYPAL_MCP_RECEIPT_CHECK=1`, then restart the app.
2. On a tablet or laptop, make a sale and complete the buyer checkout with a Sandbox buyer account. Open **Stand recap → Recent sales** and select the new receipt.
3. Choose **Check with PayPal in Booth Analyst**. Use the **Check selected receipt** starter in a fresh chat, or type “Check my selected receipt with PayPal.” You can also skip the selection and ask “Check my latest sale with PayPal.”
4. Booth Analyst should show a **Check receipt with PayPal Sandbox** tool call and report the captured amount, whether it matches the receipt, and any fee and net at capture that PayPal returns. Net at capture is before refunds and does not represent a bank payout.
5. Ask “Refund that one.” Booth Analyst shows **Open refund for you to confirm** and the receipt opens at its refund confirmation. Tap **Yes, refund it**, then check the receipt flips to **Refunded** and Booth Analyst doesn't claim the refund before it does.

## Implementation

- Both AG Studio tools take an optional receipt reference, matched against the stand's own receipts in the browser, and fall back to the receipt selected in the seller UI. The check sends the Lemon Pal sale ID to a seller-only route. The route resolves the PayPal order and capture IDs from storage and rejects seeded, uncaptured, or out-of-stand receipts.
- The route uses the existing Sandbox app token and PayPal's hosted MCP server. PayPal's docs list a Streamable HTTP path (`/http`), but the Sandbox server returns 404 there and answers only the SSE transport (`GET /sse`, then POSTs to the message URL it names), so `lib/paypal-mcp.ts` speaks SSE. It calls only `get_order`. It matches the stored capture ID and returns amount, currency, capture status, fee and net at capture. Fees and net are optional. Buyer data, PayPal IDs and raw tool responses stay server-side.
- The route reports a lookup failure if the Sandbox call fails. Payment state changes through the existing checkout and refund flows.

## Before the judge demo

- [ ] Confirm the deployed host can reach the Sandbox MCP endpoint. Confirm the app token works and the hosted `get_order` input and output match the [Agent Toolkit implementation](https://github.com/paypal/agent-toolkit/blob/main/typescript/src/shared/functions.ts) and the [PayPal MCP quickstart](https://developer.paypal.com/ai-tools/mcp-server/).
- [ ] Verify capture status, currency, amount, fee and net against the same receipt in PayPal Sandbox. Check a refunded receipt and confirm the assistant describes the net as the amount at capture.
- [ ] Rehearse a missing fee, an upstream failure, a seeded receipt, and an unauthenticated request. Confirm the assistant reports missing or failed lookups accurately and that the route returns only payment fields.
- [ ] Rehearse the selected-receipt handoff in a fresh and an existing Booth Analyst chat. Switch between two receipts and confirm the answer names the one selected.
- [ ] Record one sign-to-checkout sale, then check that receipt with Booth Analyst. Include PayPal Sandbox MCP in the Devpost tools list once the recorded workflow works end to end.

## Other Sandbox MCP tools, checked November 7, 2026

- `get_merchant_insights` replies that it isn't supported in the Sandbox.
- `list_transactions` returns 403 until the REST app has the Transaction Search permission.
- `list_disputes` works, but it lists the whole PayPal account's disputes. Every stand shares one Sandbox seller account, so it would need filtering by the seller's own captures before Booth Analyst could use it.
- Invoicing tools (`create_invoice`, `send_invoice`, …) are listed and untested.

