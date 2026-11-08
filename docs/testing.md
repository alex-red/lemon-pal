# Testing Lemon Pal

There are no automated tests yet. Run `bun run typecheck` and `bun run lint` before calling a change done, then check it by hand as below.

## PayPal Sandbox buyer

> **Sandbox only.** These are published on purpose: a throwaway PayPal Sandbox test login with fake money. It isn't a real PayPal account, holds nothing of value, and won't sign in on paypal.com.

Use this account to pay on `/pay/<saleId>`. It is a PayPal **Sandbox** personal account: it holds test money only and works only on `sandbox.paypal.com`, never on real PayPal.

| | |
|---|---|
| Email | `sb-k43vrk53722534@personal.example.com` |
| Password | `5LHm<#aN` |

The same values sit in `.env.local` as `PAYPAL_SANDBOX_USER_EMAIL` and `PAYPAL_SANDBOX_USER_PASS`, for tools that sign in automatically.

## Demo data

- **Demo accounts:** on `/stand/unlock`, **Create new demo account** makes an account of your own with the sticker shop: a stand at events, an open store at `/peel-and-stick-<tag>` and about 360 made-up sales. The browser remembers it under **On this browser**, so you can sign out and come back. Unused demo accounts are deleted after 30 days.
- **Sticker shop again:** in a demo account, open **Reset demo** on `/stand/recap` and choose **Load sticker shop**, or use **Load sticker shop demo** in the store editor. Demo sales are marked `demo: true`, so refunding one or marking it shipped never calls PayPal.
- **Start over:** **Reset demo** brings back the lemonade stand and deletes every sale.

## Checklist

### In-person sale
1. On `/stand/register`, tap a few items and press **Charge**.
2. Scan the code with a phone, or open the `/pay/<saleId>` link, and pay with the Sandbox buyer.
3. The register shows **Paid** and dings.

### Online store with shipping
1. In `/stand/store`, turn on **Taking orders** and **Shipping**, and mark at least one item **Ships**.
2. Open the store at `/<handle>`, choose **Shipping**, add items and press **Checkout**.
3. Pay with the Sandbox buyer. PayPal asks for an address.
4. Check that the pay page shows Paid and that the order appears under **To ship** on `/stand/orders`.
5. Mark it shipped with a tracking number, and check the tracking reached PayPal (the order sheet says so).
6. Try an address in a country the store doesn't ship to. Nothing is charged, and the buyer is sent back to the store.

### Customer preview
1. In the store editor, press **Preview as customer**. A **Customer preview** bar shows at the top.
2. Add items and press **Checkout**. The checkout preview shows the total with a greyed-out PayPal button.
3. Check that no sale was created (the recap and `/stand/orders` don't change).

### Pal, the stand assistant
1. On `/stand/register`, tap **Ask Pal** and send "Mark Happy Toast sold out". A card shows the change, and the tile greys out.
2. Press **Undo**. The tile is back, and asking "Is Happy Toast in stock?" gets the right answer.
3. Send "Refund the last sale". A **Refund** card appears and nothing is refunded yet. Press **Not now**, then ask whether it went through: Pal says it didn't.
4. On `/stand/store`, send "Close the store for today". The editor shows **Taking orders** off. **Undo** turns it back on.
5. On `/stand/jar`, send "Set a $500 goal". The poster's goal bar changes straight away, and **Undo** puts it back.
6. On the register, tap the camera in Pal's chat, pick a sign photo and send it. Pal reads it, applies the changes on one card, and names any line it couldn't read.
7. On a tablet, send "Chart sales by hour" from any screen. The Sales desk opens with the question typed into Booth Analyst. On a phone, Pal says charts need a bigger screen.

### Seller passcode
1. Set `SELLER_PASSCODE` in `.env.local` and restart the dev server.
2. Open `/stand/register` in a private window. It sends you to `/stand/unlock`.
3. A wrong passcode is refused. The right one makes a demo account and lets you in. **Create new demo account** doesn't ask again in that browser.
4. In that private window before unlocking, `/<handle>?preview=1` shows no preview bar, and `/<handle>/checkout` sends you back to the store.

### Log in with PayPal
Needs `PAYPAL_LOGIN=on` and the app's Return URL set in the Developer Dashboard (see the README). PayPal refuses `localhost` there, so run this at `http://127.0.0.1:3000`.
1. Open `http://127.0.0.1:3000/stand/unlock` and press **Log in with PayPal**.
2. Sign in with the Sandbox buyer. The consent screen asks only for name, email, verification status and payer ID.
3. After **Agree and Connect** you land on setup for a new, empty stand named after the account.
4. Open the stand switcher: it lists only that stand, and the Account row shows the account's name and email. A demo account's stands aren't reachable from it (another seller's `?stand=` gives 404).
5. Sign out and log in again. You get the same seller and stand, not a new one.
6. In the switcher, **Rename or delete** renames the stand. Make a second stand, then delete it: you land on the first one. Deleting your only stand is refused.
7. In **Account**, **Delete my account** asks first, then deletes the seller and every stand, and the unlock page says so. A demo account deletes the same way, and the sign-in page stops offering it.

### Screen sizes
Check each screen you changed at 320px wide, on a tablet and on a 1920px desktop, in both orientations.
