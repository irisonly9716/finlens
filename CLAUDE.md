# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FinLens (CS 6983 Project 3, solo): a Next.js app showing source-traceable financial
metrics for US public companies from SEC EDGAR XBRL data, industry peer percentiles, and
an AI "recent developments" brief whose claims are checked against cited sources.
`docs/PRD.md` is the spec — feature IDs (F1–F7) and acceptance criteria IDs (e.g.
`F2-2`) are written to map directly onto tests; reference them in test names and commits.
`docs/proposal.md` is the approved one-page proposal.

The repo is currently a scaffold (create-next-app + Vitest); most of the architecture
below is planned in the PRD, not yet built.

## Commands

```bash
npm run dev          # Next dev server (Turbopack) on :3000
npm run build
npm run lint         # ESLint 9 flat config (next core-web-vitals + typescript)
npm run typecheck    # next typegen && tsc --noEmit (typegen needed for LayoutProps/PageProps globals)
npm test             # vitest run
npm run test:watch
npx vitest run src/lib/domain/metrics.test.ts   # single file
npx vitest run -t "F2-2"                         # tests matching a name
```

## Stack notes

- **Next.js 16.4 App Router, React 19.3, Tailwind 4, TypeScript strict.** APIs differ
  from older Next versions; the bundled docs at `node_modules/next/dist/docs/` match the
  installed version — check them before relying on memory.
- `next.config.ts` enables `cacheComponents` and `partialPrefetching`, and wires
  Tailwind through `@tailwindcss/turbopack` (no PostCSS config).
- Path alias `@/*` → `src/*`.
- Vitest: tests live at `src/**/*.test.{ts,tsx}`; default environment is `node`.
  Component tests opt into the DOM with a `// @vitest-environment jsdom` comment at the
  top of the file.
- `.gitattributes` forces LF line endings (dev machine is Windows).

## Planned architecture (from PRD §6–7)

- **`src/lib/domain/`** — pure TypeScript, no I/O: XBRL concept resolution (ordered
  fallback concepts + admin overrides), fiscal period alignment (`fy`/`fp`, not
  calendar), derived Q4 = FY − 9M YTD, restatement handling (latest filing wins),
  consistency checks, peer percentiles, and the AI citation checker. Developed with TDD,
  target ≥ 80% line coverage. Missing values are `null` with a reason, never `0`.
- **`src/lib/sources/`** — thin adapters for SEC EDGAR, GDELT news, and the Claude API;
  mocked in unit tests, recorded fixtures in integration tests.
- **All external calls are server-side** (route handlers / server actions): SEC has no
  CORS and requires a descriptive `User-Agent` and ≤ 10 req/s; GDELT is fetched only by
  a scheduled job (≥ 5 s spacing) and cached, never on page view; the Anthropic key must
  never reach the browser.
- **Supabase** (Postgres + Auth, RLS on every user-owned table); Vercel deploy + Vercel
  Cron for daily refresh; GitHub Actions CI; Playwright for E2E.
- **AI brief (F5):** model from `ANTHROPIC_MODEL` (default `claude-opus-5-5`), structured
  JSON output validated with Zod via `messages.parse()`; every claim cites bundle source
  ids (`m:<metric>:<period>`, `f:<accession>`, `n:<id>`), and a deterministic checker
  verifies ids and numbers before saving. Cached once per company per day. Always show
  the "Not investment advice" disclaimer, and "News via the GDELT Project" attribution
  wherever headlines appear. Store headlines/links only, never article bodies.
