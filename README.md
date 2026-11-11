# Lemon Pal 🍋

**A lemonade stand for everyone.** Create a stand for anything, and get paid instantly.

Bake sale, garage sale, merch table, a kid's lemonade stand: if you can write a price sign, you can sell with Lemon Pal. There's no card reader to buy and no cash box to watch. Snap a photo of your sign, and customers pay with PayPal on their own phone.

The seller photographs their handwritten sign. Claude reads the items, prices and deals like "2 for $5" into a draft, and the seller checks it before anything goes on sale. The confirmed items become a tablet register. The buyer scans a QR code for that one sale and pays with PayPal on their phone. The seller's screen flips to **Paid** only after PayPal confirms the capture, and the Sales desk in AG Studio shows what sold, with an assistant that charts it on request.

Pal, a smiling lemon, rides along on every seller screen. Ask it in plain words, typed or spoken, to mark something sold out, add a "2 for $5" deal, close the store for the day or set a fundraising goal, and the change lands at once with an Undo button. Anything that moves money or can't be taken back, like a refund or marking an order shipped, comes back as a card the seller confirms.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). Everything runs in PayPal's Sandbox, so no real money moves.

## How Lemon Pal meets the judging criteria

- **Technological Implementation.** Six parts of the PayPal Developer Platform and three uses of Claude run in one flow, listed with their source files in the next section. The server prices every sale from the stored catalog, and a sale is marked paid only after PayPal's capture is checked for status, amount and currency. Every create, capture and refund sends a `PayPal-Request-Id`, so a retry can't charge or refund twice.
- **Design.** Lemon Pal is a whole product for the seller and the buyer: setup, a tablet register, phone checkout, receipts, refunds, an online store with shipping, and a donation page. It's built on its own design kit (live at `/kit`), with light and dark modes, 320px phones to desktop, and status always shown with color, an icon and a word.
- **Potential Impact.** It's for people who sell a few days a year: a convention artist, a bake sale, a school fundraiser. They already have a handwritten price sign and a phone. Lemon Pal removes typing a catalog into a point-of-sale app and buying a card reader, and it tells the seller when one specific order is paid, which a plain payment link doesn't.
- **Innovation/Idea.** The paper sign is the setup, and a new photo of it later updates the stand. Pal then runs the stand from plain words, typed or spoken. Each change lands with an Undo button. Anything that moves money comes back as a card, and PayPal is called only when the seller taps confirm.
- **Presentation.** The demo video follows one sale from a cardboard sign to a PayPal capture to the Sales desk. The steps under [Try the demo](#try-the-demo) repeat it on the hosted build.

## Where PayPal and AI are used

| Integration | What it does | Where |
| --- | --- | --- |
| PayPal JavaScript SDK v6 | PayPal Checkout buttons on the buyer's phone | [`app/pay/[saleId]/checkout.tsx`](app/pay/[saleId]/checkout.tsx) |
| PayPal Orders v2: create and capture | The server creates and captures each order, with an itemized breakdown and shipping | `createOrder`, `captureOrder` in [`lib/paypal.ts`](lib/paypal.ts) |
| Capture verification | Status, amount and currency are checked before the register shows **Paid** | `verifyCapture` in [`lib/paypal.ts`](lib/paypal.ts) |
| PayPal refunds | A seller refunds a receipt from the Sales desk or an order | `refundCapture`, `verifyRefund` in [`lib/paypal.ts`](lib/paypal.ts) |
| PayPal shipment tracking | A shipped order's tracking number goes to PayPal | `addTracking` in [`lib/paypal.ts`](lib/paypal.ts) |
| Log in with PayPal | Sellers sign in with their PayPal account (behind `PAYPAL_LOGIN=on`) | [`lib/paypal-login.ts`](lib/paypal-login.ts) |
| PayPal MCP server | Booth Analyst reads a receipt's capture, fee and net from PayPal (behind `PAYPAL_MCP_RECEIPT_CHECK`) | [`lib/paypal-mcp.ts`](lib/paypal-mcp.ts) |
| Claude Haiku 5.5: vision and structured outputs | Reads a sign photo into a draft catalog with prices and deals, and leaves an unclear price empty | [`lib/sign-reader.ts`](lib/sign-reader.ts) |
| Claude Haiku 5.5: agent with a server-side tool loop | Pal changes the stand with Undo, and proposes refunds and shipping for the seller to confirm | [`lib/pal.ts`](lib/pal.ts) |
| Claude Haiku 5.5 in AG Studio's Agent Framework | Booth Analyst adds charts to the Sales desk through a custom Claude adapter | [`lib/studio-llm.ts`](lib/studio-llm.ts), [`app/stand/recap/claude-adapter.ts`](app/stand/recap/claude-adapter.ts) |
| AG Studio and AG Grid | The Sales desk: custom widgets, live updates, item filtering and our own theme | [`app/stand/recap/`](app/stand/recap) |

## What a seller can do

| | Route | What happens |
| --- | --- | --- |
| **Set up from a photo** | `/stand/setup` | Take a photo of the sign with the in-page camera, pick one from the library, or paste a price list. Claude Haiku 5.5 returns a draft catalog through structured outputs: the stand name, an emoji per item, prices and multi-buy deals. A price it can't read comes back empty and flagged, and the stand can't open until the seller fills it in. A new photo of the sign later updates the stand, marking items sold out and changing prices. Four sample sign photos and four sample stands are there for anyone without a sign. |
| **Ring up a sale** | `/stand/register` | Tap item tiles and press **Charge**. The server prices the cart from the confirmed catalog and applies deals with plain arithmetic, so the client never sets a price. The register shows a QR code for that sale. |
| **Get paid** | `/pay/[saleId]` | The buyer's phone shows the stand, the items, any deal and the total, then opens PayPal Checkout. The server creates and captures the Orders v2 order. |
| **Know it's paid** | `/stand/register` | The register shows **Paid** and plays a ding only after the capture is checked for status, amount and currency. Every create and capture sends a `PayPal-Request-Id` derived from the sale, so a retried or canceled checkout can't charge twice. The paid screen shows the time from photo to first sale. |
| **See what sold** | `/stand/recap` | The Sales desk is an AG Studio dashboard with live stand totals, standouts by units and sales, and recent receipts. Select an item to filter its receipts. **Ask Booth Analyst** opens AG Studio's assistant, run by Claude Haiku 5.5, which adds charts to the dashboard. Receipts can be refunded through PayPal from here. |
| **Sell online** | `/<handle>`, `/stand/store`, `/stand/orders` | An online stand is a public storefront with pickup or shipping. Shipping is priced on the server and sent in the PayPal order breakdown, and an address outside the store's countries is never charged. The seller marks orders shipped and the tracking number goes to PayPal. **Preview as customer** shows the store without making a sale. |
| **Ask Pal** | Every seller screen | Pal is a stand assistant run by Claude Haiku 5.5, with tools that read and change the stand on the server. It edits items, prices, deals, sold out, the stand's name, store and shipping settings, donation amounts and goals, and which donor notes the display shows. Each change lands at once on a card with **Undo**. Refunds, marking orders shipped or picked up, and deleting a stand come back as a card instead, and run through the same route as the screen's own button only when the seller taps confirm. Send it a photo of the sign and it applies what changed, or tap the mic and talk. Chart questions are passed to Booth Analyst with the question already typed. |
| **Take donations** | `/<handle>`, `/stand/jar` | A donation stand is one fixed QR code for pay-what-you-want gifts, with presets, limits, a goal bar and donors' notes. `/stand/jar` shows it as a poster for the table. |

One seller can run several stands (at events, online, or donations) and switch between them.

## Try the demo

**Hosted demo:** _link added after the Render deploy_. You need two screens: a tablet or laptop for the seller and a phone for the buyer.

1. Open the demo on the seller screen. On the sign-in page, choose **Try a demo account**, enter the passcode given in the Devpost entry's testing instructions, and press **Create new demo account**. Sellers with a PayPal account can choose **Log in with PayPal** instead.
2. Your demo account is your own. It starts with a sticker shop (a stand at events and an online store, each with a month of made-up sales) and a fundraiser for an animal rescue. The browser remembers it for 30 days under **On this browser**.
3. To try sign reading, open the stand switcher, add a stand at events, and photograph a price sign or pick one of the sample sign photos. Check the draft, fill in anything flagged, and open the register.
4. On the register, tap a few items and press **Charge**. Scan the QR code with the phone's camera, check the items and total, and pay with PayPal using the Sandbox buyer below.
5. The seller screen shows **Paid** and plays a ding. Tap anything on the seller screen first so the browser allows sound.
6. Open the Sales desk to find the receipt. Select an item to filter its receipts. On a tablet or laptop, open **Ask Booth Analyst** and choose **Chart sales by item**.
7. Tap **Ask Pal** on any seller screen. Try **Mark something sold out** or "Make Busy Bee $3.50", watch the register change, then press **Undo**. Ask "Refund the last sale" to see the confirm card, and press **Not now** to keep the sale. On the register, tap the camera in Pal's chat and send a sign photo.
8. Switch to the online store to order with pickup or shipping, or to the fundraiser to scan its QR code and give.

**Sandbox buyer** (PayPal Sandbox test login with fake money, published on purpose; it doesn't work on real PayPal):

| | |
| --- | --- |
| Email | `sb-k43vrk53722534@personal.example.com` |
| Password | `5LHm<#aN` |

**Starting over:** **Reset demo** on the Sales desk brings back the sticker shop or a fresh sample stand. The made-up sales are marked as demo data, so refunding one or marking it shipped never calls PayPal.

See [docs/testing.md](docs/testing.md) for a fuller checklist.

## What's next

- **Get paid directly.** Payments for every stand go to one PayPal Sandbox seller account today. Next, each seller links their own account through [PayPal's seller onboarding](https://developer.paypal.com/platforms/seller-onboarding) and gets paid straight away.
- **Native seller apps** for iPhone, iPad and Android, with camera capture and haptics on every sale. The buyer side stays a web page, so customers never need an app.

## Built with

- [Next.js 16](https://nextjs.org/) and React 19, TypeScript, Tailwind CSS 4
- [PayPal Checkout](https://developer.paypal.com/checkout/) (JavaScript SDK v6), the Orders v2 REST API, refunds and shipment tracking, and [Log in with PayPal](https://developer.paypal.com/docs/log-in-with-paypal/), all in the Sandbox
- [Claude Haiku 5.5](https://platform.claude.com/docs) through the Anthropic API, for reading signs with structured outputs, for the Booth Analyst, and for Pal, whose tool loop runs on the server so the model only sees results the server made. The API key stays on the server. Prompt caching and context editing keep long chats fast and cheap.
- [PayPal's MCP server](https://developer.paypal.com/ai-tools/mcp-server/) (Sandbox, behind `PAYPAL_MCP_RECEIPT_CHECK`), so Booth Analyst can check a receipt's capture and fees with PayPal. Booth Analyst can also open a refund for the seller to confirm. It never moves money itself.
- [AG Grid](https://www.ag-grid.com/) and [AG Studio](https://www.ag-grid.com/studio/) for the Sales desk, with custom widgets, our own theme and a Claude adapter for its Agent Framework. AG Studio is commercial software under its own licence and runs with a watermark without a licence key.
- SQLite through Node's built-in `node:sqlite`, on [Render](https://render.com/) with a persistent disk
- [Bun](https://bun.sh/) as the package manager

## Run locally

Requires [Bun](https://bun.sh/) 1.4+, Node.js 24+ (for the built-in `node:sqlite`), and a [PayPal Sandbox REST app](https://developer.paypal.com/dashboard/applications/sandbox).

```bash
bun install
cp .env.example .env.local   # then fill in the values
bun run dev
```

Open <http://localhost:3000>. The dev server listens on your local network too, so a phone on the same Wi-Fi can scan a sale's QR code: when the register runs on `localhost`, the code points at your machine's network address (the **Network** URL `next dev` prints) instead. Set `PUBLIC_APP_URL` to override it. If PayPal's buttons won't load on the phone over plain HTTP, use a tunnel or the hosted demo, which serve HTTPS.

To let sellers sign in with their own PayPal accounts, open your app in the [Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox), turn on **Log in with PayPal** under **Other features**, and set its Return URL to `<your app URL>/api/auth/paypal/callback`. Share the full name, email, account verification status and payer ID (Lemon Pal never needs the address), and set the privacy policy and user agreement URLs (any URL works in the Sandbox). Then set `PAYPAL_LOGIN=on`. The Return URL must match the address you open the app at. On a server, set `PUBLIC_APP_URL` to it. Locally, PayPal won't accept `localhost` in a Return URL, so register `http://127.0.0.1:3000/api/auth/paypal/callback` and open the app at <http://127.0.0.1:3000> to sign in.

Other scripts: `bun run typecheck`, `bun run lint`, `bun run build`, `bun run start`.

`bun run typecheck` runs the native TypeScript 7 compiler through the `typescript7` alias. The main `typescript` package is 6.0.3. It provides the compiler API used by typescript-eslint and the default compiler CLI used by `next build`.

## Deploy on Render

[`render.yaml`](render.yaml) is a Render Blueprint for one Node web service with a 1 GB persistent disk, which holds the SQLite database. Disks need a paid instance (Starter). Create the service from the Blueprint in the Render dashboard and enter the secret environment variables when asked. Set `PUBLIC_APP_URL` to the service's HTTPS URL so QR codes point at it.

## Project layout

```
app/stand/        Seller screens: setup, register, Sales desk, store, orders, donation poster
app/[handle]/     Public storefronts and donation pages
app/pay/          Buyer checkout opened from the QR code
app/api/          Server endpoints: sales, PayPal order and capture, sign reading, sign-in, Pal and Booth Analyst
components/kit/   Citrus Glass, the design kit (live reference at /kit)
lib/              Domain types, money, storage, PayPal and Claude clients, demo data
```

## Contributing

Issues and pull requests are welcome. Please don't include real credentials, customer data, or photos of people in issues, commits, or test fixtures.

## License

Copyright (c) 2026 Alex Red. Licensed under the [Apache License, Version 2.0](LICENSE).
