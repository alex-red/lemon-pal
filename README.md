# Lemon Pal 🍋

**A lemonade stand for everyone.** Create a stand for anything, and get paid instantly.

Bake sale, garage sale, merch table, a kid's lemonade stand: if you can write a price sign, you can sell with Lemon Pal. There's no card reader to buy and no cash box to watch. Snap a photo of your sign, and customers pay with PayPal on their own phone.

Under the hood, Lemon Pal turns that handwritten price sign into a working register. The seller photographs the sign, checks the names and prices an AI vision model read from it, and rings up sales on a tablet. The buyer scans a QR code and pays with PayPal on their own phone. The seller's screen flips to **Paid** the moment PayPal confirms the capture, and the stand recap in AG Studio shows what sold.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). Status: in development. Sign reading, the register, PayPal checkout, and the AG Studio recap are implemented. Not yet deployed.

## How it works

| Step | Route | What happens |
| --- | --- | --- |
| Create your stand | `/stand/setup` | A photo of the sign (taken with the in-page camera or chosen from the library) or a pasted price list → vision model → reviewable draft catalog with the stand name and an emoji per item. Unreadable prices must be entered by the seller. Sellers can also start blank, or pick a sample stand (lemonade, bake sale, merch table, garage sale). |
| Ring up a sale | `/stand/register` | Tap item tiles, then show a lemon-badged QR code for this sale. The server snapshots the cart and prices it from the confirmed catalog. |
| Pay | `/pay/[saleId]` | The buyer's phone shows the stand name and order, then opens PayPal Checkout. The server creates and captures the order. PayPal emails the buyer a receipt. |
| Confirm | `/stand/register` | The seller tablet polls the sale status and shows **Paid** only after a completed capture for the expected amount and currency. |
| Recap | `/stand/recap` | AG Studio dashboard with live stand totals, product leaders by units and sales, linked receipt filtering, and a Booth Analyst that can add charts. |

All pricing, PayPal calls, and AI calls run on the server. Secrets never reach the browser.

## Try the demo

You need two screens: a tablet or laptop for the seller and a phone for the buyer. Everything runs in PayPal's Sandbox, so no real money moves.

1. Open **TODO: hosted demo URL** on the seller screen and choose **Create your stand**. Photograph a price sign, or pick a sample stand such as **Lemonade Stand** or **School Bake Sale**.
2. On **Take a payment**, tap a few items and press **Charge**.
3. Scan the QR code with the phone's camera. Check the items and total, then pay with PayPal using the Sandbox buyer account below.
4. The seller screen shows **Paid** and plays a ding (tap anything on the seller screen first so the browser allows sound).
5. Open **See your sales** to find the receipt in AG Studio. Select a product to filter its receipts. On a tablet or laptop, open **Ask Booth Analyst** and choose **Chart sales by item**.

**Sandbox buyer:** TODO: Sandbox personal account email and password. These are PayPal test credentials that only work in the Sandbox.

**Starting over:** **Reset demo** on the recap restores the sample stand and deletes test sales. Other people may be trying the demo at the same time, so you might see their sales too.

## What's next

The demo runs every stand through one PayPal Sandbox seller account, so judges can try it without signing up. Next up:

- **Connect your own PayPal.** Each seller links their account through [PayPal's seller onboarding](https://developer.paypal.com/platforms/seller-onboarding), and payments go straight to them.
- **Many stands per person.** Keep a stand for the bake sale and another for the merch table, and switch between them.
- **Native seller apps** for iPhone, iPad and Android, with haptics on every sale. The buyer side stays a web page, so customers never need an app.

## Built with

- [Next.js 16](https://nextjs.org/) and React 19, TypeScript, Tailwind CSS 4
- [PayPal Checkout](https://developer.paypal.com/checkout/) and the Orders v2 REST API (Sandbox)
- [AG Grid](https://www.ag-grid.com/) and [AG Studio](https://www.ag-grid.com/studio/) for the stand recap. AG Studio is commercial software under its own licence; it runs with a watermark without a licence key. The recap's assistant uses AG Studio's Agent Framework, with Claude Haiku 5.5 called through a server route. Prompt caching and context editing keep long chats fast and cheap.
- [Claude Haiku 5.5](https://platform.claude.com/docs) reads price-sign photos into a draft catalog, using structured outputs
- [Bun](https://bun.sh/) as the package manager

## Run locally

Requires [Bun](https://bun.sh/) 1.4+, Node.js 24+ (for the built-in `node:sqlite`), and a [PayPal Sandbox REST app](https://developer.paypal.com/dashboard/applications/sandbox).

```bash
bun install
cp .env.example .env.local   # then fill in the values
bun run dev
```

Open <http://localhost:3000>. The dev server listens on your local network too, so a phone on the same Wi-Fi can scan a sale's QR code: when the register runs on `localhost`, the code points at your machine's network address (the **Network** URL `next dev` prints) instead. Set `PUBLIC_APP_URL` to override it. If PayPal's buttons won't load on the phone over plain HTTP, use a tunnel or the hosted demo, which serve HTTPS.

Other scripts: `bun run typecheck`, `bun run lint`, `bun run build`, `bun run start`.

`bun run typecheck` runs the native TypeScript 7 compiler through the `typescript7` alias. The main `typescript` package is 6.0.3. It provides the compiler API used by typescript-eslint and the default compiler CLI used by `next build`.

## Deploy on Render

[`render.yaml`](render.yaml) is a Render Blueprint for one Node web service with a 1 GB persistent disk, which holds the SQLite database. Disks need a paid instance (Starter). Create the service from the Blueprint in the Render dashboard and enter the secret environment variables when asked. Set `PUBLIC_APP_URL` to the service's HTTPS URL so QR codes point at it.

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
