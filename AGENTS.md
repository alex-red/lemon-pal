<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lemon Pal

## Commands

- `bun install` installs dependencies. Use Bun, not npm or pnpm, and commit `bun.lock`.
- `bun run typecheck` runs the TypeScript 7 compiler. `bun run lint` runs ESLint. Run both before you call a change done.
- `bun run dev` and `bun run build` need a filled-in `.env.local` (copy `.env.example`). There are no tests yet.

## Gotchas

- Write the product name as "Lemon Pal", two words, in all text. Lowercase `lemonpal` is only for identifiers and paths (package, database file, icons, Render service), so leave those as they are.
- Keep `typescript` within typescript-eslint's supported range. `bun run typecheck` selects the native compiler via the `typescript7` alias.
- Files that import `server-only` (everything in `lib/` except `money.ts`, `deals.ts`, `donations.ts`, `types.ts`, `ding.ts`, `emoji.ts`, `handles.ts`, `shipping.ts`, `stands.ts`, `seller-auth.ts`, `session-token.ts`, and `pal-events.ts`) can't be imported by `"use client"` components. Use `import type` from them in client code.
- `lib/store.ts` uses Node's built-in `node:sqlite` with one connection per process, at `DATABASE_PATH` (default `.data/lemonpal.sqlite`). It assumes a single instance, so don't deploy to serverless or scale out. Keep all persistence behind the `Store` interface, and use `updateSale` for any status change.
- AG Studio is large. Import it only through `app/stand/recap/recap-loader.tsx`, which loads it on the client only.
- The AG Studio assistant runs its loop in the browser and sends each turn to `/api/studio/llm` (`lib/studio-llm.ts`). Claude's assistant turns, thinking blocks included, are cached there by item id and replayed unchanged. Keep that cache when changing the adapter, or tool loops will fail.
- Pal, the stand assistant (`lib/pal.ts`, `POST /api/stand/pal`), runs its tool loop on the server and saves each chat's history through the store (`pal_records`), so the model only sees tool results the server made. Keep the history append-only. A chat also keeps the bubbles the seller saw, so it reopens after a reload or restart. Chats, undo records and waiting proposals are deleted a week after their last use, and with the seller. Tools re-read the stand with `loadStand` and save catalogs through `withCatalog` in `lib/catalog.ts`, like the setup screen. A change goes through `record`, which gives the seller an Undo card. Anything that moves money or reaches outside the app (refunds, shipping, deleting) goes through `propose_action`: the browser runs it through the screen's existing route only when the seller taps confirm (`runAction` in `app/stand/pal/pal.tsx`), never from a tool. Store settings are checked with `storeProblem`, the same check the store editor uses. A chat mid-turn lives in `live` on `globalThis`, and notes for it go through `updateChat`, so the turn's own save doesn't overwrite them. Chart questions go to Booth Analyst through `app/stand/pal/handoff.ts`, which fills Studio's `.ag-studio-ai-assistant-textarea`, so recheck it after any `ag-studio` upgrade. A sign photo sent to Pal goes through `readSign` first, and Pal only gets the result as text inside `<sign_read>`, so the chat history never holds images.
- Studio's theme lives in `app/stand/recap/studio-theme.ts`. Pass every color through its `c()` helper. Studio reads some colors back with `getComputedStyle` (widget titles, charts) and drops `oklch()`, so a bare `var(--ink)` renders black. Only set a param when the kit needs a different value than Studio derives from its parent. Card spacing CSS goes in the `studio-layout.ts` theme part, one Studio class per rule, and needs rechecking after any `ag-studio` upgrade. So does the assistant glow in `globals.css`, which targets `.ag-studio-ai-assistant-input`.

## Payment rules

- Money is integer cents (`lib/money.ts`). Convert to PayPal's decimal strings only inside `lib/paypal.ts`.
- The server prices every sale from the stored catalog. Never trust a price or total sent by the client.
- A sale becomes `paid` only in the capture route, and only after `verifyCapture` accepts it. Every PayPal create or capture call sends a `PayPal-Request-Id` derived from the sale id, so retries can't charge twice.
- The one exception is the demos: the sticker shop (`lib/demo-stickers.ts`, loaded by `loadStickerShop`), the fundraiser (`lib/demo-fundraiser.ts`, loaded by `loadFundraiser`) and the display's Simulate a gift button. They write made-up paid sales marked `demo: true`, and only into demo accounts. Any route that calls PayPal for an existing sale (refund, tracking) must check `sale.demo` and stay local for those.
- Donations (`channel: "donation"`) are the one place the client sends an amount, because the donor chooses it. `giftProblem` in `lib/donations.ts` checks it against the stand's stored presets and min/max before a sale is created, and the sale is one `donation` line of that amount. A donor's note goes through `cleanNote` and is seller-only, like a buyer's name.
- Online orders (`channel: "online"`) are priced by `priceOnlineOrder` in `lib/storefront.ts`, shipping included. `totalCents` is the lines after deals plus `shippingCents`, and `createOrder` sends shipping in the breakdown. A shipped order's country is checked against the store's list before capture, so an address the seller can't reach is never charged.

## Sellers and stands

- A user owns several stands, each `local` (the register, at events), `online` (a storefront and orders) or `donation` (one fixed QR code for pay-what-you-want gifts). A donation stand has no items: its page is a `Storefront` with `donation` settings, edited at `/stand/jar/edit` and shown as a poster at `/stand/jar`.
- Sellers sign in with Log in with PayPal (`lib/paypal-login.ts`, `/api/auth/paypal`, behind `PAYPAL_LOGIN=on`) and get their own user (`lib/accounts.ts`), or make a demo account on the sign-in page past the passcode (`POST /api/unlock`, `createDemoAccount` in `lib/demo.ts`). Each demo account is one person's, starts with the sticker shop, and is deleted after 30 days unused. The browser keeps its signed session token in localStorage (`app/stand/demo-accounts.ts`) to sign back in through `/api/unlock/resume`. There's no shared demo user: `proxy.ts` sends a browser without a valid session to sign in, and nothing falls back to a default seller.
- Seller routes take their stand from `lib/session.ts`, never from a constant. Pages call `currentStand(kind?)`. APIs call `requestStand(request)`, which reads the `?stand=` id the page sends (add it with `standApi`) and returns null for a stand the user doesn't own. Routes that take a sale id check it with `ownedSale`.
- Only a local stand rings up sales, and only an online or donation stand serves a page at `/<handle>`. These checks are on the server, not just in the UI. A page that needs a kind the seller lacks redirects with `homeOfCurrentStand()`, never to another kind's home, so it can't loop.
- Delete with `store.deleteStand` or `store.deleteUser`, which take a stand's sales and storefront with it in one transaction. A seller always keeps at least one stand.

## Online store and seller pages

- `proxy.ts` puts `/stand/*` and `/api/stand/*` behind a signed-in seller, and only the passcode makes a demo account. Anything that returns buyer names or addresses goes under `/api/stand/`. Public routes (`/<handle>`, `/pay`, `/api/store/*`) must never return an address. `publicSale` gives only the town.
- Store handles live at the root (`app/[handle]`). Add any new top-level route or `public/` folder name to `RESERVED` in `lib/handles.ts`.
- Catalog item ids change on every publish, so the online and shipping flags sit on `CatalogItem` and follow an item by name in `POST /api/stand`.

## Design kit (Citrus Glass)

- Build UI from `@/components/kit`. `/kit` is the living reference: check it before adding a component, and add new shared pieces to both.
- Use the semantic tokens from `app/globals.css` (`ink`, `ink-2`, `fill`, `hairline`, `lemon`, `leaf`, `berry`, and so on) and the named text styles (`text-title1`, `text-headline`, …). Don't write raw hex, grey or default Tailwind palette colors, or they'll break in dark mode.
- Glass (`Glass`, `Toolbar`, `Sheet`, `.glass*`) is for chrome that floats over content. Content goes on `Card` or `GroupedList`. Don't nest glass in glass.
- Each screen gets one `filled` button: the action the person came to do. Everything else uses `tinted`, `ghost` or `plain`. Inside a toolbar, use `ghost`.
- Tap targets are at least 44px tall. Register tiles stay the largest target on the seller's screen.
- Check every screen from 320px phones to 1920px desktops, both orientations. For height, use the `short` (landscape under 34rem tall) and `tight` (portrait under 40rem tall) variants from `globals.css`, and `justify-center-safe` instead of `justify-center` so tall content never goes above the top.
- Show status with color, an icon and a word together (`SaleStatusPill`, `Pill`). Never use color alone.
- Show prices with `Money`, which formats from cents and labels the amount for screen readers. Don't hand-format amounts in markup.
- Fonts follow Apple's HIG: `font-display` (Fraunces) for titles only, `font-sans` (SF Pro, falling back to Hanken Grotesk), `font-price` for changing numbers, and `font-mono` (SF Mono). Never put prices or totals in Fraunces: it has no fixed-width digits, so they jitter. Size text with the rem-based `text-*` styles, never px, so it follows Dynamic Type on iPhone and iPad.
- Text on lemon is always dark (`oklch(0.23 0.03 85)`), not `text-ink`, because `ink` turns light in dark mode.
- `cn` joins classes but doesn't resolve conflicts. Add a variant or prop instead of overriding a component's color or radius through `className`.
- Write only the standard `backdrop-filter`. Next's CSS minifier keeps just one copy when both are present and drops the standard one, so blur silently disappears in Chrome.
- Reduce Motion, Reduce Transparency and Increase Contrast are handled globally in `globals.css`. New animation should use the `--ease-*` / `--animate-*` tokens so those overrides still apply.

### Motion

`/kit#motion` shows every piece below.

- Pick a named spring, never an ad-hoc curve: `--ease-smooth` (no bounce) for layout and long moves, `--ease-snappy` for small swaps, `--ease-spring` for touch release and sheets, `--ease-bounce` only for celebrations, `--ease-glide` for fades and color.
- While AI works, glow the thing being worked on (`AIGlow`) and say what's happening (`ShimmerText`). Spinners belong only inside buttons. Results that arrive in bulk reveal with `useReveal`, and a `MoreBelow` pill counts the rows not yet seen.
- Screen changes that keep an object (Charge into the code card, a total into the big price) use React's `<ViewTransition>`. Only updates inside `startTransition` animate. Give a named pair `share="morph"` and `default="none"`: with `default="none"` and no `share`, the pair silently stops morphing. A morphed element must hug its content (`self-start` in a flex column), or its snapshot stretches.
- Wrap each page's content in `PageTransition` in `page.tsx`, not a layout. Tag in-app links and `router.push` with `transitionTypes={["nav-forward"]}` going deeper, or `["nav-back"]` going back out. `ListRow` links already tag forward.
- The global Reduce Motion rule doesn't reach `::view-transition-*` pseudo-elements. A new view-transition class needs its own crossfade-only rule in the `prefers-reduced-motion` block. Feedback that means "working" should breathe in place under Reduce Motion, not stop.
- A hidden browser pane pauses animation frames, so `requestAnimationFrame`, scroll-driven animations and view transitions appear broken there. Check motion in a visible browser.

## Boundaries

- This is a public open-source repo (Apache-2.0). Never commit secrets, real customer data, or photos of people. Add new environment variables to `.env.example` with blank values.
- Every photo in `public/demo/` is generated with Codex image generation, not taken or downloaded. Make new demo photos the same way.
- The official PayPal starter (`paypaldev/hackathon-paypal-ag-grid-boilerplate`) has no license. Read it for reference only and don't copy its code.
- `docs/hackathon/` holds private planning notes and is gitignored. Don't link to it from tracked files.
- Ask before adding a dependency. Pin exact versions.

## Commits

- Start the subject with a type prefix: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `style:`, `perf:`, `ci:`, `build:`, or `dev:` for local tooling and developer experience.
- Keep the subject short, lowercase after the prefix, in the imperative, with no trailing period. Example: `feat: add paypal buttons to buyer checkout`.
- Add a body only when the reason isn't obvious from the subject. Write a sentence or two of plain prose, not a list of every file changed.
