# LemonPal 🍋

LemonPal turns a handwritten price sign into a working register for a pop-up stand. The seller photographs the sign, checks the names and prices an AI vision model read from it, and rings up sales on a tablet. The buyer scans a QR code and pays with PayPal on their own phone. The seller's screen flips to **Paid** the moment PayPal confirms the capture, and the stand recap in AG Studio shows what sold.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). Status: in development. Sign reading, the register, and PayPal checkout are implemented. The recap is not built yet.

## How it works

| Step | Route | What happens |
| --- | --- | --- |
| Set up the stand | `/stand/setup` | Photo of the sign → vision model → reviewable draft catalog. Unreadable prices must be entered by the seller. |
| Ring up a sale | `/stand/register` | Tap item tiles, then show a QR code for this sale. The server snapshots the cart and prices it from the confirmed catalog. |
| Pay | `/pay/[saleId]` | The buyer's phone opens PayPal Checkout. The server creates and captures the order. |
| Confirm | `/stand/register` | The seller tablet polls the sale status and shows **Paid** only after a completed capture for the expected amount and currency. |
| Recap | `/stand/recap` | AG Studio report over completed sales and line items. |

All pricing, PayPal calls, and AI calls run on the server. Secrets never reach the browser.

## Built with

- [Next.js 16](https://nextjs.org/) and React 19, TypeScript, Tailwind CSS 4
- [PayPal Checkout](https://developer.paypal.com/checkout/) and the Orders v2 REST API (Sandbox)
- [AG Grid](https://www.ag-grid.com/) and [AG Studio](https://www.ag-grid.com/studio/) for the stand recap. AG Studio is commercial software under its own licence; it runs with a watermark without a licence key.
- [Claude Sonnet 5.5](https://platform.claude.com/docs) reads price-sign photos into a draft catalog, using structured outputs
- [Bun](https://bun.sh/) as the package manager

## Run locally

Requires [Bun](https://bun.sh/) 1.4+, Node.js 20.9+, and a [PayPal Sandbox REST app](https://developer.paypal.com/dashboard/applications/sandbox).

```bash
bun install
cp .env.example .env.local   # then fill in the values
bun run dev
```

Open <http://localhost:3000>. To test the buyer flow from a phone, the phone must reach your machine over HTTPS; a tunnel or the hosted demo works best.

Other scripts: `bun run typecheck`, `bun run lint`, `bun run build`, `bun run start`.

`bun run typecheck` runs the native TypeScript 7 compiler through the `typescript7` alias. The main `typescript` package is 6.0.3. It provides the compiler API used by typescript-eslint and the default compiler CLI used by `next build`.

## Project layout

```
app/stand/        Seller screens: setup, register, recap
app/pay/          Buyer checkout opened from the QR code
app/api/          Server endpoints: sales, PayPal order and capture, sign reading
lib/              Domain types, money helpers, storage, PayPal client
```

## Contributing

Issues and pull requests are welcome. Please don't include real credentials, customer data, or photos of people in issues, commits, or test fixtures.

## License

[MIT](LICENSE)
