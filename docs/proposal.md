# P3 Proposal — FinLens

Posted to the course Slack for approval. Iris Ge (working solo).

**One line:** FinLens is a web app for self-directed retail investors that shows a US
public company's key financial metrics from SEC filings, ranks them against industry
peers, and adds an AI brief of recent developments — with every number and every AI
claim traceable to its source.

**Problem:** Free finance sites show numbers without saying where they came from, peer
comparison is manual, and AI summaries of news cannot be checked.

**Core features**
1. Company page: 5 years + 4 quarters of key metrics (revenue, margins, cash flow, debt)
   from SEC EDGAR XBRL data.
2. Source drill-down: every number links to the exact filing, period and XBRL concept;
   derived numbers show their formula.
3. AI recent-developments brief from 8-K filings and news headlines, as structured JSON
   where each claim cites source ids; a deterministic checker verifies every cited
   number before it is shown.
4. Accounts + private watchlist with change flags; industry peer percentiles (SIC code).

**Data:** SEC EDGAR APIs (public data, free to reuse, no key) + GDELT news headlines
(terms allow public use and redistribution; headlines and links only, with
attribution). No dummy data.

**Stack:** Next.js + TypeScript + Tailwind, Supabase (Postgres, Auth, RLS), Vitest +
Playwright, GitHub Actions, Vercel. Built with Claude Code.

**How it differs from my P1 and P2:** P1 was an ADHD study planner (Claude artifact);
P2 (CommonPot) was shared household expense tracking. FinLens is public-company
financial analysis with real public data — a different problem, user and data source.

**Not investment advice:** no price predictions or buy/sell signals; a disclaimer is
always shown.
