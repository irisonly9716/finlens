# F1 Company lookup — implementation plan

## Context
FinLens is a scaffold. F1 (PRD §4) is the entry point of the core flow
(search → company page → drill-down → brief): a ticker resolves case-insensitively to a
CIK via the SEC ticker file (F1-1), a name query returns ≤ 10 prefix matches (F1-2), and
an unknown query shows an empty state with suggestions, not an error (F1-3).
Exploration notes: `docs/exploration/f1-company-lookup.md`.

Decisions from the user (fixed):
1. F1-3 suggestions: tickers within edit distance 1 (APPL → AAPL), then ticker/name
   prefix matches; at most 5.
2. No type-ahead, no API route: `next/form` on the home page submits to `/search?q=`.
3. Company URL `/company/[ticker]`, stub page (F2 fills it later).
4. Matching ignores case and punctuation (`BRK.B` = `brk b` = `BRK-B`); rank exact
   ticker > ticker prefix > name prefix; exact ticker hit redirects to the company page.
5. Ticker file `https://www.sec.gov/files/company_tickers.json` (fix PRD §5), cached
   with `"use cache"` + `cacheLife('days')`; no Supabase / schema change now.
6. Zod may be installed (ask at `npm install` time).

**`server-only` finding** (`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md:584-604`,
`02-guides/data-security.md:255`): Next handles `import 'server-only'` internally and
ships its types; installing the npm package is optional (only for lint rules on
extraneous deps, which our ESLint config does not enable). **Decision: don't install it.**
Vitest doesn't get Next's internal handling, so add a `resolve.alias` in
`vitest.config.mts` mapping `server-only` to an empty stub (`src/test/server-only-stub.ts`).

## Design

### Pure domain — `src/lib/domain/company-search.ts`
- Types: `TickerRow { cik: number; ticker: string; name: string }`,
  `CompanyEntry { cik: string /*10-digit*/; ticker: string; name: string; tickerKey; nameKey }`
  (plain objects → serializable, can be returned from a `"use cache"` function).
- `padCik(n): string` — zero-pad to 10 digits.
- `normalizeTicker(s)` — uppercase, strip everything except `A-Z0-9`
  (`BRK.B`/`brk b`/`BRK-B` → `BRKB`).
- `normalizeName(s)` — lowercase, punctuation → space, collapse whitespace, trim
  (`"Apple Inc."` → `"apple inc"`).
- `buildCompanyIndex(rows): CompanyEntry[]` — keeps SEC file order (roughly by size, so
  earlier = more relevant tie-break); dedupes duplicate `tickerKey` (first wins).
  GOOG/GOOGL (same CIK, different tickers) both stay.
- `searchCompanies(index, query): SearchResult`, discriminated union:
  - `{ kind: "empty_query" }` — blank after normalization.
  - `{ kind: "exact", company }` — `tickerKey` equals normalized query (F1-1).
  - `{ kind: "matches", companies }` — ticker-prefix hits, then name-prefix hits,
    deduped by ticker, capped at 10 (F1-2).
  - `{ kind: "no_match", suggestions }` — from `suggestCompanies` (F1-3).
- `suggestCompanies(index, query): CompanyEntry[]` — tickers with Levenshtein distance
  exactly 1 to the normalized query (cheap O(n) ≤1 check, no full DP), then ticker
  prefix, then name prefix; deduped; ≤ 5. Note: on the `no_match` path the prefix lists
  are empty by definition, so in practice suggestions are the edit-distance hits; the
  function still honours the full order so it can be reused (e.g. a "did you mean"
  later).
- No I/O, no `Date.now()`, no throwing on bad input.

### SEC adapter — `src/lib/sources/sec.ts` (`import 'server-only'`)
- `secFetchJson(url, fetchImpl = fetch)` — sends `User-Agent` from `SEC_USER_AGENT`
  (throws a clear config error if unset), `Accept: application/json`; on non-2xx throws
  `SecFetchError { status, url }` (429/403 identified for callers). No retry loop yet;
  the shared 10 req/s limiter arrives with F2 when there are many calls.
- `fetchTickerRows(fetchImpl?)` — uncached; Zod-validates the file
  (`z.record(z.string(), z.object({ cik_str: z.number().int(), ticker: z.string(), title: z.string() }))`)
  and maps to `TickerRow[]`.
- `src/lib/sources/company-index.ts` — `getCompanyIndex()` with `"use cache"` +
  `cacheLife('days')` → `buildCompanyIndex(await fetchTickerRows())`. Kept separate so
  the uncached fetch is testable without Next's cache runtime.

### UI (async Server Components; Next 16 Cache Components rules)
- `src/app/page.tsx` — replace placeholder: title, `<Form action="/search">` with a
  labelled `<input name="q">` (keyboard-accessible, progressive enhancement).
- `src/app/search/search-params.ts` — Zod schema: `q` is `string | string[] | undefined`
  → first value, trimmed, max 100 chars; invalid → treated as empty.
- `src/app/search/page.tsx` — static shell + `<Suspense>` child that awaits
  `searchParams` (runtime API must be inside Suspense with `cacheComponents`), validates,
  calls `getCompanyIndex()` + `searchCompanies`. `exact` → `redirect('/company/' + ticker)`;
  otherwise renders `<SearchResults>`. `SecFetchError` → "SEC data temporarily
  unavailable" notice (not an error page).
- `src/components/SearchResults.tsx` — presentational, sync: matches list (ticker, name,
  CIK, link to `/company/[ticker]`), F1-3 empty state ("No company matches “X”" +
  suggestion links), empty-query prompt.
- `src/app/company/[ticker]/page.tsx` — stub inside Suspense: resolves the param through
  the index with the same normalization; non-canonical form (`aapl`, `BRK.B`) →
  redirect to canonical `/company/BRK-B`; unknown → `redirect('/search?q=…')` so the
  F1-3 empty state shows instead of a 404. Renders name, ticker, CIK, "metrics coming
  soon" (F2).
- `src/app/layout.tsx` — metadata title/description "FinLens".
- Before writing pages: re-read `02-components/form.md`, `04-functions/redirect.md`
  (redirect from inside a Suspense boundary), `08-caching.md`.

## Steps (one commit each)

1. **Save this plan** to `docs/plans/f1-company-lookup.md`, commit
   `docs(plan): F1 company lookup`. **Stop and wait for go-ahead.**
2. **PRD fix** — §5: ticker file lives at `https://www.sec.gov/files/company_tickers.json`
   (not `data.sec.gov`). Commit `docs(prd): correct SEC ticker file host (F1-1)`.
3. **Deps + test setup** — ask, then `npm install zod`; add `server-only` alias + stub
   in `vitest.config.mts`; add `.env.example` with `SEC_USER_AGENT=FinLens/0.1 (CS 6983
   project; <contact email>)`. Verify: `npm test`, `npm run typecheck`, `npm run lint`.
   Commit `chore(f1): add zod, server-only test stub, env example (F1-1)`.
4. **Fixture** — small real excerpt of `company_tickers.json` in
   `src/lib/domain/__fixtures__/company-tickers.json` (≈ 15 rows: AAPL, APP, AMAT,
   MSFT, GOOGL, GOOG, BRK-B, BRK-A, a few "Apple…"/"Applied…" names). **You** download
   the full file into `../tmp/` (outside the repo) with your contact email in the UA.
   When we get here I give you the exact command, e.g. from the repo root:
   `! mkdir -p ../tmp && curl.exe -sS -A "FinLens/0.1 (CS 6983 project; <your email>)" -o ../tmp/company_tickers.json https://www.sec.gov/files/company_tickers.json`
   I then only read `../tmp/company_tickers.json` and write the excerpt; the full file is
   never copied into or committed to the repo. The excerpt is committed with step 5.
5. **F1-1 red** — tests in `src/lib/domain/company-search.test.ts`:
   `F1-1: padCik pads to 10 digits`, `F1-1: ticker match is case-insensitive (aapl → AAPL, CIK 0000320193)`,
   `F1-1: ignores punctuation (BRK.B, brk b, BRK-B → BRK-B)`,
   `F1-1: duplicate ticker rows keep the first`, `F1-1: blank query → empty_query`.
   Commit `test(f1): company lookup by ticker (F1-1) (red)`.
6. **F1-1 green** — `normalizeTicker`, `padCik`, `buildCompanyIndex`, exact branch of
   `searchCompanies`. Commit `feat(f1): resolve ticker to CIK (F1-1) (green)`.
7. **F1-2 red** — `F1-2: name prefix ignores case and punctuation ("apple" → Apple Inc.)`,
   `F1-2: ranks ticker prefix above name prefix`, `F1-2: returns at most 10`
   (inline synthetic index of 15 rows), `F1-2: no duplicates when ticker and name both match`,
   `F1-2: prefix only, not substring`. Commit `test(f1): name prefix search (F1-2) (red)`.
8. **F1-2 green** — `normalizeName`, matches branch. Commit
   `feat(f1): name prefix search (F1-2) (green)`.
9. **F1-3 red** — `F1-3: APPL suggests AAPL (edit distance 1)`, `F1-3: covers
   insertion/deletion/substitution`, `F1-3: distance-1 hits come before prefix hits`,
   `F1-3: at most 5`, `F1-3: unknown query returns no_match with suggestions, never throws`.
   Commit `test(f1): suggestions for unknown queries (F1-3) (red)`.
10. **F1-3 green** — `suggestCompanies`, no_match branch. Commit
    `feat(f1): suggest tickers for unknown queries (F1-3) (green)`.

   **Refactors:** after any green step (6, 8, 10), if a refactor is worth doing it gets
   its own commit, tests green before and after, e.g.
   `refactor(f1): share prefix matching between search and suggestions (F1-3)`.
   No refactor is folded into a red or green commit.
11. **SEC adapter** — `sec.ts`, `company-index.ts` + `sec.test.ts` with a mocked
    `fetchImpl` (and `vi.mock('next/cache')` for the cached wrapper): sends UA header,
    missing env → clear error, 403/429 → `SecFetchError`, malformed JSON → Zod error,
    valid file → `TickerRow[]`. Commit `feat(f1): SEC ticker file adapter (F1-1)`.
12. **Search params + results component** — `search-params.ts` (+ unit test) and
    `SearchResults.tsx` (+ jsdom test: renders matches with links; F1-3 empty state
    shows suggestions and no error text). Commit `feat(f1): search results view (F1-2, F1-3)`.
13. **Pages** — home form, `/search`, `/company/[ticker]` stub, layout metadata. Commit
    `feat(f1): search form, results page and company stub (F1-1, F1-2, F1-3)`.
14. **Wrap-up** — append verification results to `docs/exploration/f1-company-lookup.md`
    (or a short note in the plan). Commit `docs(f1): record verification`.

Every step: `npm test`, `npm run lint`, `npm run typecheck` green (except intended red
commits, where only the new tests fail).

## Verification (end of F1)
- `npm test` — all `F1-1/F1-2/F1-3` tests pass; `npx vitest run -t "F1-"` lists them.
- `npm run lint`, `npm run typecheck`, `npm run build` succeed (build must not need SEC:
  search/company pages are dynamic, so no fetch at prerender).
- Manual with `npm run dev` and `SEC_USER_AGENT` in `.env.local` (you set it; I don't read
  `.env` files):
  - F1-1: `aapl`, `AAPL`, `brk.b`, `BRK B` → redirect to `/company/AAPL` / `/company/BRK-B`
    showing CIK `0000320193` / `0001067983`.
  - F1-2: `apple` → list of ≤ 10 prefix matches, ticker-prefix hits first.
  - F1-3: `APPL`-style typo with no prefix hits (e.g. `MSFY`) → empty state with
    suggestion (MSFT), HTTP 200, no error page; `/company/ZZZZZ` → redirected to the
    same empty state.
  - Form works by keyboard and with JS disabled (progressive enhancement).
- Coverage: `@vitest/coverage-v8` is not installed; ≥ 80% domain coverage check can be
  added with CI later (would need another approved install).
