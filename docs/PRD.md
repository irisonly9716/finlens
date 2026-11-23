# FinLens — Product Requirements

Draft v0.1 · 2026-11-22 · Iris Ge (solo) · CS 6983 Project 3

## 1. Summary

FinLens gives self-directed retail investors a one-page, source-traceable view of a US
public company: key financial metrics from SEC filings, how the company ranks against
its industry peers, and an AI brief of recent developments in which every claim links
to its source. Its promise: **every number and every AI sentence can be traced back to
where it came from.**

## 2. Problem

Investors who read fundamentals themselves run into three gaps:

- **Untraceable numbers.** 10-K and 10-Q filings are long. Free finance sites show
  figures without saying which filing, period or line item they came from, or that a
  quarter was derived rather than reported.
- **Manual peer comparison.** Knowing whether a 38% gross margin is good means
  collecting the same metric for the company's industry peers by hand.
- **Uncheckable summaries.** News and 8-K filings are scattered; general AI chatbots
  summarize them, but their claims cannot be checked against sources.

Assumptions to validate with 3+ Mom Test interviews in Sprint 1 (results go in
`docs/research/`):

- **A1:** users check a number against its source at least occasionally.
- **A2:** users compare a company with peers today, and do it manually.
- **A3:** users distrust AI summaries that carry no sources.

**Non-goals:** price prediction, buy/sell recommendations, real-time quotes, portfolio
tracking with positions.

## 3. Users and roles

| Role | Can do |
|---|---|
| Visitor | Search, company page, source drill-down, peer ranking, cached AI brief |
| Investor (signed in) | Everything above + watchlist and change flags |
| Admin | Fix concept-mapping overrides, review data-quality issues, trigger a refresh |

## 4. Features and acceptance criteria

Priority uses MoSCoW. Acceptance criteria (AC) are written to become tests directly.

### F1 Company lookup — Must
- **F1-1** Searching by ticker is case-insensitive and resolves to a CIK via the SEC
  ticker file.
- **F1-2** Searching by company name returns up to 10 prefix matches.
- **F1-3** An unknown ticker shows an empty state with suggestions, not an error page.

### F2 Key metrics — Must
Canonical metrics: revenue, gross profit, gross margin, operating income, operating
margin, net income, net margin, operating cash flow, free cash flow, cash, total debt,
debt-to-equity. Shown for the last 5 fiscal years and the last 4 quarters.
- **F2-1 Concept resolution.** Each canonical metric has an ordered list of us-gaap
  concepts (e.g. revenue: `Revenues`, `RevenueFromContractWithCustomerExcludingAssessedTax`,
  `SalesRevenueNet`). For each period, the first concept with a value wins, and the
  concept used is recorded. An admin override for that company and metric wins over
  the list.
- **F2-2 Derived Q4.** When a fiscal year value and its 9-month year-to-date value both
  exist but Q4 is not reported, Q4 = FY − 9M YTD, marked `derived`.
- **F2-3 Fiscal periods.** Periods are labeled by the company's fiscal year and quarter,
  not the calendar. A fact's fiscal period comes from its own `start`/`end` dates
  measured against the company's fiscal year-end, not from the companyfacts `fy`/`fp`
  fields: those describe the filing, so comparative facts carry the filing's year.
- **F2-4 Missing inputs.** A metric whose inputs are missing is `null` with a reason
  (`no_data`, `missing_input:<name>`), never `0`.
- **F2-5 Restatements.** When the same period appears in several filings, the value
  from the latest filing is shown; earlier values stay available as history.
- **F2-6 Consistency check.** If gross profit and cost of revenue are both reported,
  |revenue − cost of revenue − gross profit| must be within 0.5% of revenue; otherwise
  the period gets a data-quality flag.

### F3 Source drill-down — Must
- **F3-1** Every reported number shows form type, fiscal period, filing date, us-gaap
  concept, accession number and a link to the filing on sec.gov.
- **F3-2** Every derived number (margins, ratios, derived Q4) shows its formula and
  links to each input's source.

### F4 Peer ranking — Should
- **F4-1** Peers are companies with the same 4-digit SIC code; with fewer than 5 peers,
  fall back to the 2-digit SIC group. The peer count is always shown.
- **F4-2** For each margin and ratio in the latest fiscal year, show the company's
  percentile among peers (rank-based, ties share the average rank).
- **F4-3** Peers without a value for that metric are excluded from that metric only.

### F5 AI recent-developments brief — Must
Input bundle: the company's 8-K filings from the last 90 days (item codes, filing date,
short excerpt), news headlines from the last 30 days, and the F2 metrics. Every item in
the bundle has a stable source id (`m:gross_margin:FY2025`, `f:<accession>`, `n:<id>`).

Output (structured JSON): 3–5 `events` `{title, sentiment: positive|negative|neutral,
summary, related_metric?, source_ids[]}` and up to 3 `watch_items` `{text, source_ids[]}`.
- **F5-1** Every event and watch item cites at least one source id, and every cited id
  exists in the input bundle.
- **F5-2 Citation checker.** Every number in an event summary must match (after
  rounding to the shown precision) a number in one of its cited sources. Claims that
  fail are marked `unverified` and hidden by default.
- **F5-3** A brief is generated at most once per company per day; later visits read
  the cached brief.
- **F5-4** With no 8-Ks and no news in range, no model call is made and the page says
  so.
- **F5-5** The brief always shows the disclaimer "For informational purposes only. Not
  investment advice."
- **F5-6 8-K categories.** 8-K item codes map to event categories before the model
  sees them: 2.02 earnings; 5.02 leadership change; 1.01/1.02 material agreement;
  2.01 acquisition or disposition; 2.05/2.06 restructuring or impairment; 4.01/4.02
  auditor change or non-reliance (high severity); 1.05 cybersecurity incident (high
  severity). Items 7.01, 8.01 and 9.01 alone are "other".

### F6 Watchlist — Must
- **F6-1** Signed-in users can add and remove companies; the list is private
  (row-level security: users read and write only their own rows).
- **F6-2** Each watchlist row shows flags since the user's last visit: new 10-K/10-Q/8-K
  filed, or a margin that moved more than 3 percentage points.

### F7 Admin data quality — Could
- **F7-1** Admins see the list of data-quality flags (F2-6) and unresolved concepts.
- **F7-2** Admins can set a concept override for a company and metric (used by F2-1).

## 5. Data sources

- **SEC EDGAR APIs** (`data.sec.gov`, public data). Fair-access rules: every request
  sends a descriptive `User-Agent` with contact email, max 10 requests/second; all calls
  are server-side and cached.
  - `https://www.sec.gov/files/company_tickers.json` — ticker → CIK (served from
    `www.sec.gov`, not `data.sec.gov`; same `User-Agent` rules).
  - `submissions/CIK##########.json` — name, SIC code, recent filings (form, date,
    accession number, primary document, 8-K items).
  - `api/xbrl/companyfacts/CIK##########.json` — every XBRL fact with value, period,
    `fy`, `fp`, form, filing date and accession number.
  - `api/xbrl/frames/...` — one concept across all companies for one period (peers).
  - No API key. EDGAR content is "free to access and reuse"; cite the SEC as the source.
  - Filing link: `https://www.sec.gov/Archives/edgar/data/{CIK}/{accession without
    dashes}/{primaryDocument}`.
  - Frames: `CY2025` = annual, `CY2025Q1` = one quarter's duration, `CY2025Q1I` = a
    point-in-time (balance-sheet) value at quarter end.
  - Official docs say `data.sec.gov` does not support CORS, so all calls go through the
    server (which also lets us set `User-Agent` and share one rate limit).
- **News headlines — GDELT DOC 2.0 API.** Chosen because its terms allow public,
  unrestricted use and redistribution ("academic, commercial, or governmental"), which a
  deployed app needs. Requirements and limits:
  - Every page that shows GDELT headlines shows "News via the GDELT Project" with a link.
  - No ticker filter: query the exact company name as a phrase with `sourcelang:english`;
    drop results whose title does not contain the name.
  - About one request per 5 seconds, and it returns HTTP 429 when busy, so news is
    fetched by a scheduled job (curated + watchlisted companies, spaced ≥ 5 s apart) and
    cached; page views never call GDELT directly.
  - Store headline, publisher domain, URL and publish time only; never article bodies.
- **Rejected news APIs** (checked 2026-11-22): NewsAPI.org free plan is "development
  and testing … only"; Alpha Vantage news is premium-only; Finnhub, Marketaux and
  Massive free tiers are limited to personal use, and Finnhub forbids redistributing
  "derived results". Finnhub (ticker filter, 1 year of history) can be added later only
  with written permission from Finnhub.

## 6. Architecture

```mermaid
graph LR
  UI[Next.js pages] --> API[Route handlers / server actions]
  API --> DOM[Domain logic<br/>pure TypeScript]
  API --> SEC[SEC EDGAR]
  API --> NEWS[News API]
  API --> LLM[Claude API]
  API --> DB[(Supabase Postgres<br/>Auth + RLS)]
  CRON[Vercel Cron: daily refresh] --> API
  GH[GitHub Actions CI] --> VERCEL[Vercel deploy]
```

- **Next.js 16 (App Router) on Vercel.** All external calls (SEC, news, Claude) run on
  the server; no key reaches the browser.
- **`src/lib/domain/`** — pure functions with no I/O: concept resolution, period
  alignment, metrics, consistency checks, percentiles, citation checker. This is where
  TDD happens.
- **`src/lib/sources/`** — thin adapters for SEC, news and Claude; mocked in unit tests,
  exercised with recorded fixtures in integration tests.
- **Supabase** — Postgres + Auth. Tables (draft): `companies`, `facts_cache`, `metrics`,
  `filings`, `news_items`, `briefs`, `watchlists`, `concept_overrides`, `data_issues`.

## 7. AI design (F5)

- **Model:** `claude-opus-5-5` by default, configurable through the `ANTHROPIC_MODEL`
  environment variable; `effort: "low"` to start, tuned with the eval below.
- **Structured outputs:** request JSON that matches a schema (`output_config.format`,
  validated with Zod via the SDK's `messages.parse()`). The API's built-in Citations
  feature is not used: it cannot be combined with structured outputs, and FinLens needs
  its own source ids anyway.
- **Grounding:** the prompt lists the bundle items with their ids and says to cite ids
  only; the deterministic checker (F5-1, F5-2) runs on every response before saving.
- **Cost controls:** one brief per company per day (F5-3); a global daily cap on model
  calls; `max_tokens` set; a spend limit in the Anthropic Console; key stored only in
  Vercel/Supabase environment variables.
- **Failure handling:** `stop_reason` of `refusal` or `max_tokens` → no brief saved, the
  page shows the previous brief or a notice.
- **Eval (Sprint 3):** ~20 saved company bundles; measure the share of cited sources that
  exist and the share of claims that pass the checker.

## 8. Non-functional requirements

- **Security:** secrets only in environment variables; RLS on every user-owned table;
  Zod validation on every route input; rate limiting on API routes; `npm audit` and
  secret scanning in CI.
- **Performance:** cached company page < 1 s; first fetch of a company < 5 s.
- **Accessibility:** keyboard navigation; flags use icon + text, not color alone.
- **Quality:** TDD for `src/lib/domain/` with ≥ 80% line coverage; Playwright E2E for the
  core flow (search → company page → source drill-down → brief).

## 9. Milestones

| Sprint | Dates | Scope |
|---|---|---|
| 1 | Nov 23 – Dec 1 | F1, F2, F3 for ~20 curated companies; interviews; CI |
| 2 | Dec 2 – Dec 8 | F5 (brief + checker), F6 (auth + watchlist) |
| 3 | Dec 9 – Dec 15 | F4, F7 if time; security audit; eval; deploy polish; demo |

Final submission: Finals Week (Dec 14–20; exact date on Canvas).

## 10. Risks

| Risk | Mitigation |
|---|---|
| Companies tag the same metric with different XBRL concepts | Ordered fallback lists, admin overrides, start with curated companies |
| SEC fair-access limits | Server-side cache, `User-Agent`, backoff on 429/403 |
| LLM cost or made-up claims | Daily cache and caps; deterministic citation checker |
| News licensing | GDELT (terms allow redistribution) with attribution; headlines and links only |
| GDELT throttling, name collisions | Scheduled fetch spaced ≥ 5 s, cache; exact-phrase query + title filter; 8-Ks still give a brief when news is missing |
| Solo scope | MoSCoW; F4 and F7 can slip without breaking the core flow |

## 11. Open questions

- Model for F5: keep `claude-opus-5-5`, or switch `ANTHROPIC_MODEL` to a cheaper model
  after the eval shows whether quality holds.
- Which ~20 companies form the curated starting set (spread across 4–5 industries).

## 12. Glossary

- **10-K / 10-Q / 8-K:** annual report / quarterly report / current report on a material
  event.
- **XBRL, us-gaap concept:** machine-readable tags in filings; a concept is one tag such
  as `Revenues`.
- **CIK:** SEC's company id. **Accession number:** id of one filing.
- **SIC code:** Standard Industrial Classification code of the company's industry.
