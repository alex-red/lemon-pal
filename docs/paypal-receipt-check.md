# Booth Analyst PayPal receipt check

**Status** · Scaffolded behind `PAYPAL_MCP_RECEIPT_CHECK=1`. Keep the flag off on the judge demo until the Sandbox rehearsal passes.

## Try it

1. Use the Lemon Pal Sandbox REST app credentials in `.env.local`. Set `PAYPAL_ENV=sandbox` and `PAYPAL_MCP_RECEIPT_CHECK=1`, then restart the app.
2. On a tablet or laptop, make a sale and complete the buyer checkout with a Sandbox buyer account. Open **Stand recap → Recent sales** and select the new receipt.
3. Choose **Check with PayPal in Booth Analyst**. Use the **Check selected receipt** starter in a fresh chat, or type “Check my selected receipt with PayPal.”
4. Booth Analyst should show a **Check receipt with PayPal Sandbox** tool call and report the captured amount, whether it matches the receipt, and any fee and net at capture that PayPal returns. Net at capture is before refunds and does not represent a bank payout.

## Implementation

- The AG Studio tool takes zero arguments and uses the receipt selected in the seller UI. It sends the Lemon Pal sale ID to a seller-only route. The route resolves the PayPal order and capture IDs from storage and rejects seeded, uncaptured, or out-of-stand receipts.
- The route uses the existing Sandbox app token and PayPal's hosted MCP server over Streamable HTTP. It calls only `get_order`. It matches the stored capture ID and returns amount, currency, capture status, fee and net at capture. Fees and net are optional. Buyer data, PayPal IDs and raw tool responses stay server-side.
- The route reports a lookup failure if the Sandbox call fails. Payment state changes through the existing checkout and refund flows.

## Before the judge demo

- [ ] Confirm the deployed host can reach the Sandbox MCP endpoint. Confirm the app token works and the hosted `get_order` input and output match the [Agent Toolkit implementation](https://github.com/paypal/agent-toolkit/blob/main/typescript/src/shared/functions.ts) and the [PayPal MCP quickstart](https://developer.paypal.com/ai-tools/mcp-server/).
- [ ] Verify capture status, currency, amount, fee and net against the same receipt in PayPal Sandbox. Check a refunded receipt and confirm the assistant describes the net as the amount at capture.
- [ ] Rehearse a missing fee, an upstream failure, a seeded receipt, and an unauthenticated request. Confirm the assistant reports missing or failed lookups accurately and that the route returns only payment fields.
- [ ] Rehearse the selected-receipt handoff in a fresh and an existing Booth Analyst chat. Switch between two receipts and confirm the answer names the one selected.
- [ ] Record one sign-to-checkout sale, then check that receipt with Booth Analyst. Include PayPal Sandbox MCP in the Devpost tools list once the recorded workflow works end to end.
