# F1 Company lookup — exploration notes

Explore phase, 2026-11-23. No code written. Next step: plan in `docs/plans/`.

## What exists today
- Scaffold only: `src/app/layout.tsx` (Geist fonts, metadata still "Create Next App"),
  `src/app/page.tsx` (create-next-app placeholder), `src/app/globals.css`. No
  `src/lib/`, no tests, no route handlers, no `.env*` files (only `.env.example` is
  un-ignored by `.gitignore`).
- `next.config.ts`: `cacheComponents: true`, `partialPrefetching: true`, Tailwind via
  `@tailwindcss/turbopack`. `tsconfig.json`: strict, `@/*` → `src/*`.
- `vitest.config.mts`: `node` env, `src/**/*.test.{ts,tsx}`; scripts as in CLAUDE.md.
- **Not installed:** `zod` (CLAUDE.md requires Zod at every boundary) and `server-only`
  (optional; Next handles the import internally). Both need an approved `npm install`.

## F1 requirements (PRD §4, §5)
- F1-1 ticker search is case-insensitive, resolves to a CIK via the SEC ticker file.
- F1-2 name search returns up to 10 prefix matches.
- F1-3 unknown ticker → empty state with suggestions, not an error page.
- Ticker file `company_tickers.json`: object keyed `"0".."N"`, each
  `{ cik_str: number, ticker: string, title: string }`, ~10k rows. CIK must be
  zero-padded to 10 digits for `submissions/CIK##########.json` URLs.
- Fair access: every request sends a descriptive `User-Agent` with contact email;
  ≤ 10 req/s; server-side only (no CORS on `data.sec.gov`); cache; back off on 429/403.

## Next.js 16 rules that apply (docs read)
- `01-app/01-getting-started/08-caching.md` — with Cache Components, `"use cache"` +
  `cacheLife(...)` caches an async function; args become the cache key. Uncached async
  work or runtime APIs (`searchParams`, `cookies`, `headers`) must sit inside
  `<Suspense>`, otherwise a "blocking-route" error. Pass runtime values *into* cached
  functions as args. Example of a search page reading `searchParams` in a Suspense child.
- `01-app/03-api-reference/01-directives/use-cache.md` — cached functions cannot call
  runtime APIs (even via helpers). Default handler is in-memory LRU: on serverless
  (Vercel) entries usually do **not** persist across requests; `"use cache: remote"` is
  the durable option. Caches reset on each deploy (key includes build id).
- `01-app/03-api-reference/04-functions/cacheLife.md` — always pair with explicit
  `cacheLife`; preset `days` = revalidate 1 day / expire 1 week.
- `01-app/01-getting-started/15-route-handlers.md` — `app/**/route.ts`; with Cache
  Components a `GET` handler follows the page prerender model; `"use cache"` cannot go
  in the handler body, only in a helper. No `route.ts` beside a `page.tsx` in one segment.
- `01-app/03-api-reference/02-components/form.md` — `next/form` `<Form action="/search">`
  turns input into `?query=` with client navigation + progressive enhancement; results
  page reads `searchParams`.
- `01-app/02-guides/environment-variables.md` — non-`NEXT_PUBLIC_` vars are server-only
  (`NEXT_PUBLIC_` is inlined at build); `.env.local` is not loaded in tests.
- `01-app/02-guides/data-security.md` — external access in a `server-only` module.
- `01-app/02-guides/testing/vitest.md` — Vitest can't render async Server Components →
  unit-test pure logic, E2E the pages.

## Where F1's pieces should live
- **`src/lib/domain/company-search.ts`** (pure, strict TDD): parse/normalize ticker
  rows, `padCik`, `searchCompanies(index, query)` → ticker hit | ≤ 10 name prefix
  matches | empty result with suggestions. No I/O. Tests named `F1-1: ...` etc., fixture
  = small real excerpt in `src/lib/domain/__fixtures__/company-tickers.json`.
- **`src/lib/sources/sec.ts`** (`import 'server-only'`): `secFetch(url)` adds the
  `User-Agent`, handles 403/429; `getTickerFile()` with `"use cache"` + `cacheLife('days')`,
  Zod-validates the response. Mocked in unit tests.
- **UI:** home `src/app/page.tsx` with `<Form action="/search">`; `src/app/search/page.tsx`
  reads `searchParams` in a Suspense child, Zod-validates `query`, calls the cached
  source + pure search; exact ticker → `redirect` to `/company/[cik]` (stub page for now),
  otherwise list or F1-3 empty state. A `GET /api/search` route handler only if we want
  type-ahead from a client component.

## Env var
- `SEC_USER_AGENT` (server-only, never `NEXT_PUBLIC_`), e.g.
  `FinLens/0.1 (CS 6983 project; <contact email>)`. Fail fast with a clear error if unset.
  Document in `.env.example`; real value in `.env.local` and Vercel env settings.

## Open questions
1. What are F1-3 "suggestions"? Ticker prefix matches, edit distance (e.g. `APPL`→`AAPL`),
   or the curated ~20 companies?
2. Search UX: submit-to-results page only, or also live type-ahead (needs route handler)?
3. Company URL key: `/company/[cik]` (stable) or `/company/[ticker]` (readable)?
4. Name prefix rules: ignore case/punctuation/"Inc."? Rank ticker hits above name hits?
5. Ticker cache: `use cache` in-memory (lost on cold starts), `use cache: remote`, or
   persist to Supabase `companies` via the daily cron (schema change → ask first)?

## Risks
- Host check: from memory the ticker file is `https://www.sec.gov/files/company_tickers.json`,
  not `data.sec.gov` as PRD §5 implies — verify before coding (also UA format, 10 req/s).
- Serverless in-memory cache → refetching ~1 MB file on cold starts; SEC may 403 if the
  UA is missing/generic. If fetched during build prerender, build needs the env var and
  SEC reachable.
- Ticker formats: SEC uses `BRK-B`; users type `BRK.B`/`brk b`. Several tickers share a
  CIK (GOOG/GOOGL); a few rows may share a ticker string — dedupe rules needed.
- New dependencies (`zod`, maybe `server-only`) need user approval to install.
