<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LemonPal

## Commands

- `bun install` installs dependencies. Use Bun, not npm or pnpm, and commit `bun.lock`.
- `bun run typecheck` runs the TypeScript 7 compiler. `bun run lint` runs ESLint. Run both before you call a change done.
- `bun run dev` and `bun run build` need a filled-in `.env.local` (copy `.env.example`). There are no tests yet.

## Gotchas

- There are two TypeScript packages. `typescript` stays on 5.x because typescript-eslint and Next.js load its JavaScript API. `typescript7` is the native compiler that `typecheck` runs. Don't upgrade `typescript` to 7.
- Files that import `server-only` (`lib/env.ts`, `lib/store.ts`, `lib/paypal.ts`, `lib/sales.ts`, `lib/demo.ts`) can't be imported by `"use client"` components. Use `import type` from them in client code.
- `lib/store.ts` keeps data in memory, so it's lost on restart and doesn't work on serverless hosts. Keep all persistence behind the `Store` interface.
- AG Studio is large. Import it only through `app/stand/recap/recap-loader.tsx`, which loads it on the client only.

## Payment rules

- Money is integer cents (`lib/money.ts`). Convert to PayPal's decimal strings only inside `lib/paypal.ts`.
- The server prices every sale from the stored catalog. Never trust a price or total sent by the client.
- A sale becomes `paid` only in the capture route, and only after `verifyCapture` accepts it. Every PayPal create or capture call sends a `PayPal-Request-Id` derived from the sale id, so retries can't charge twice.

## Boundaries

- This is a public open-source repo (MIT). Never commit secrets, real customer data, or photos of people. Add new environment variables to `.env.example` with blank values.
- The official PayPal starter (`paypaldev/hackathon-paypal-ag-grid-boilerplate`) has no license. Read it for reference only and don't copy its code.
- `docs/hackathon/` holds private planning notes and is gitignored. Don't link to it from tracked files.
- Ask before adding a dependency. Pin exact versions.
