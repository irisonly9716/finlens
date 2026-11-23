# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FinLens (CS 6983 Project 3, solo): a Next.js app showing source-traceable financial
metrics for US public companies from SEC EDGAR XBRL data, industry peer percentiles, and
an AI "recent developments" brief whose claims are checked against cited sources.
`docs/proposal.md` is the approved one-page proposal. The spec (feature IDs F1–F7 and
acceptance-criteria IDs such as `F2-2`, written to map directly onto tests):

@docs/PRD.md

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
  installed version.
- `next.config.ts` enables `cacheComponents` and `partialPrefetching`, and wires
  Tailwind through `@tailwindcss/turbopack` (no PostCSS config).
- Path alias `@/*` → `src/*`.
- Vitest: tests live at `src/**/*.test.{ts,tsx}`; default environment is `node`.
  Component tests opt into the DOM with a `// @vitest-environment jsdom` comment at the
  top of the file.
- `.gitattributes` forces LF line endings (dev machine is Windows).
- Claude Code's sandbox is not available on native Windows, so permissions use
  allowlists in `.claude/settings.json` (shared; same rules for Bash and PowerShell).
  Allowed: tests, lint, typecheck, and git status/diff/log/show/add/commit — the routine
  loop. Asked: `git push` (publishing is the user's call) and `npm install` (every new
  dependency is reviewed — AI can hallucinate package names). Denied: reading `.env`
  files, `git push --force`, `git reset --hard`.

## Planned architecture (from PRD §6–7)

- **`src/lib/domain/`** — pure TypeScript: XBRL concept resolution (ordered fallback
  concepts + admin overrides), fiscal period alignment (`fy`/`fp`, not calendar),
  derived Q4 = FY − 9M YTD, restatement handling (latest filing wins), consistency
  checks, peer percentiles, and the AI citation checker.
- **`src/lib/sources/`** — thin adapters for SEC EDGAR, GDELT news, and the Claude API.
- **External calls run in route handlers / server actions only:** SEC has no CORS and
  allows ≤ 10 req/s; GDELT is fetched only by a scheduled job (≥ 5 s spacing) and
  cached, never on page view.
- **Supabase** (Postgres + Auth, RLS on every user-owned table); Vercel deploy + Vercel
  Cron for daily refresh; GitHub Actions CI; Playwright for E2E.
- **AI brief (F5):** model from `ANTHROPIC_MODEL` (default `claude-opus-5-5`), structured
  JSON output validated with Zod via `messages.parse()`; every claim cites bundle source
  ids (`m:<metric>:<period>`, `f:<accession>`, `n:<id>`), and a deterministic checker
  verifies ids and numbers before saving. Cached once per company per day.

## Coding conventions

- TypeScript strict; no `any`.
- Explicit return types on exported functions.
- React component files PascalCase; all other files kebab-case.
- Domain code in `src/lib/domain/` is pure: no I/O, no `Date.now()` (pass time in as an
  argument). For missing data it returns `null` with a reason (`no_data`,
  `missing_input:<name>`) instead of throwing — never `0`.
- Validate every boundary with Zod: route inputs and external API responses.
- Conventional Commits that mention the acceptance-criteria id, e.g.
  `feat(f2): derive Q4 (F2-2)`.

## Testing strategy

- Strict TDD for `src/lib/domain/`:
  1. Write failing tests first and commit them as a red commit.
  2. Write the minimum code to pass (green commit).
  3. Refactor with tests green.
- Never edit a test to make it pass. If a test looks wrong, stop and ask me.
- Test names start with the AC id, e.g. `"F2-2: derives Q4 as FY minus 9M YTD"`.
- Fixtures are small real SEC JSON excerpts in `src/lib/domain/__fixtures__/`.
- Adapters in `src/lib/sources/` are mocked in unit tests.
- Playwright E2E comes later (core flow: search → company page → drill-down → brief).
- Target ≥ 80% line coverage for `src/lib/domain/`.

## Do / Don't

**Do**
- Call SEC, GDELT and Claude only from the server; every SEC request sends the
  descriptive `User-Agent` with contact email.
- Show the "For informational purposes only. Not investment advice." disclaimer with
  the brief, and "News via the GDELT Project" (linked) wherever headlines appear.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.

**Don't**
- Put secrets in client code or commit `.env` files.
- Store news article bodies — headline, publisher domain, URL and publish time only.
- Write price predictions or buy/sell language.
- Change the database schema or this CLAUDE.md without asking me first.

## Context management

- One task per session; `/clear` between tasks.
- Before clearing, write findings to `docs/exploration/` and plans to `docs/plans/`.
- When a session gets long, `/compact` with a focus note.
- Resume the last session with `claude --continue`.
