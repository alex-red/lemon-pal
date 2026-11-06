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
- Files that import `server-only` (everything in `lib/` except `money.ts`, `types.ts`, `ding.ts`, and `emoji.ts`) can't be imported by `"use client"` components. Use `import type` from them in client code.
- `lib/store.ts` uses Node's built-in `node:sqlite` with one connection per process, at `DATABASE_PATH` (default `.data/lemonpal.sqlite`). It assumes a single instance, so don't deploy to serverless or scale out. Keep all persistence behind the `Store` interface, and use `updateSale` for any status change.
- AG Studio is large. Import it only through `app/stand/recap/recap-loader.tsx`, which loads it on the client only.
- The AG Studio assistant runs its loop in the browser and sends each turn to `/api/studio/llm` (`lib/studio-llm.ts`). Claude's assistant turns, thinking blocks included, are cached there by item id and replayed unchanged. Keep that cache when changing the adapter, or tool loops will fail.
- Studio's theme lives in `app/stand/recap/studio-theme.ts`. Pass every color through its `c()` helper. Studio reads some colors back with `getComputedStyle` (widget titles, charts) and drops `oklch()`, so a bare `var(--ink)` renders black. Only set a param when the kit needs a different value than Studio derives from its parent. Card spacing CSS goes in the `studio-layout.ts` theme part, one Studio class per rule, and needs rechecking after any `ag-studio` upgrade.

## Payment rules

- Money is integer cents (`lib/money.ts`). Convert to PayPal's decimal strings only inside `lib/paypal.ts`.
- The server prices every sale from the stored catalog. Never trust a price or total sent by the client.
- A sale becomes `paid` only in the capture route, and only after `verifyCapture` accepts it. Every PayPal create or capture call sends a `PayPal-Request-Id` derived from the sale id, so retries can't charge twice.

## Design kit (Citrus Glass)

- Build UI from `@/components/kit`. `/kit` is the living reference: check it before adding a component, and add new shared pieces to both.
- Use the semantic tokens from `app/globals.css` (`ink`, `ink-2`, `fill`, `hairline`, `lemon`, `leaf`, `berry`, and so on) and the named text styles (`text-title1`, `text-headline`, …). Don't write raw hex, grey or default Tailwind palette colors, or they'll break in dark mode.
- Glass (`Glass`, `Toolbar`, `Sheet`, `.glass*`) is for chrome that floats over content. Content goes on `Card` or `GroupedList`. Don't nest glass in glass.
- Each screen gets one `filled` button: the action the person came to do. Everything else uses `tinted`, `ghost` or `plain`. Inside a toolbar, use `ghost`.
- Tap targets are at least 44px tall. Register tiles stay the largest target on the seller's screen.
- Show status with color, an icon and a word together (`SaleStatusPill`, `Pill`). Never use color alone.
- Show prices with `Money`, which formats from cents and labels the amount for screen readers. Don't hand-format amounts in markup.
- Fonts follow Apple's HIG: `font-display` (Fraunces) for titles only, `font-sans` (SF Pro, falling back to Hanken Grotesk), `font-price` for changing numbers, and `font-mono` (SF Mono). Never put prices or totals in Fraunces: it has no fixed-width digits, so they jitter. Size text with the rem-based `text-*` styles, never px, so it follows Dynamic Type on iPhone and iPad.
- Text on lemon is always dark (`oklch(0.23 0.03 85)`), not `text-ink`, because `ink` turns light in dark mode.
- `cn` joins classes but doesn't resolve conflicts. Add a variant or prop instead of overriding a component's color or radius through `className`.
- Write only the standard `backdrop-filter`. Next's CSS minifier keeps just one copy when both are present and drops the standard one, so blur silently disappears in Chrome.
- Reduce Motion, Reduce Transparency and Increase Contrast are handled globally in `globals.css`. New animation should use the `--ease-spring` / `--animate-*` tokens so those overrides still apply.

## Boundaries

- This is a public open-source repo (MIT). Never commit secrets, real customer data, or photos of people. Add new environment variables to `.env.example` with blank values.
- The official PayPal starter (`paypaldev/hackathon-paypal-ag-grid-boilerplate`) has no license. Read it for reference only and don't copy its code.
- `docs/hackathon/` holds private planning notes and is gitignored. Don't link to it from tracked files.
- Ask before adding a dependency. Pin exact versions.

## Commits

- Start the subject with a type prefix: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `style:`, `perf:`, `ci:`, `build:`, or `dev:` for local tooling and developer experience.
- Keep the subject short, lowercase after the prefix, in the imperative, with no trailing period. Example: `feat: add paypal buttons to buyer checkout`.
- Add a body only when the reason isn't obvious from the subject. Write a sentence or two of plain prose, not a list of every file changed.
