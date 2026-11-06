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

- **Sticker shop:** on `/stand/recap`, open **Reset demo** and choose **Load sticker shop**, or use **Load sticker shop demo** in the store editor. It fills a catalog, an open store at `/peel-and-stick` and about 360 made-up sales. Demo sales are marked `demo: true`, so refunding one or marking it shipped never calls PayPal.
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

### Seller passcode
1. Set `SELLER_PASSCODE` in `.env.local` and restart the dev server.
2. Open `/stand/register` in a private window. It sends you to `/stand/unlock`.
3. A wrong passcode is refused. The right one lets you in.
4. In that private window before unlocking, `/<handle>?preview=1` shows no preview bar, and `/<handle>/checkout` sends you back to the store.

### Log in with PayPal
Needs `PAYPAL_LOGIN=on` and the app's Return URL set in the Developer Dashboard (see the README). PayPal refuses `localhost` there, so run this at `http://127.0.0.1:3000`.
1. Open `http://127.0.0.1:3000/stand/unlock` and press **Log in with PayPal**.
2. Sign in with the Sandbox buyer. The consent screen asks only for name, email, verification status and payer ID.
3. After **Agree and Connect** you land on setup for a new, empty stand named after the account.
4. Open the stand switcher: it lists only that stand, and the Account row shows the account's name and email. The demo stands aren't reachable (`/api/stand/recap?stand=demo` gives 404).
5. Sign out and log in again. You get the same seller and stand, not a new one.
6. In the switcher, **Rename or delete** renames the stand. Make a second stand, then delete it: you land on the first one. Deleting your only stand is refused.
7. In **Account**, **Delete my account** asks first, then deletes the seller and every stand, and the unlock page says so. The demo seller has no delete button, and its stands can't be deleted.

### Screen sizes
Check each screen you changed at 320px wide, on a tablet and on a 1920px desktop, in both orientations.
