Project Name: FinLens – Source-Traceable Financials for US Public Companies
Project 3 Proposal · Arianna Ge (working solo)

Description:
FinLens is a web app for people who pick stocks themselves and want to understand a company from its real numbers. Today they read long 10-K and 10-Q filings, or they use finance sites that show a figure without saying where it came from. Companies label the same metric in different ways, the fourth quarter is often calculated by the site but shown as if it were reported, and comparing a company with its industry means collecting numbers by hand. News and 8-K filings are scattered, and AI chatbots summarize them without sources, so their claims can't be checked.

FinLens gives each company one page. A user searches by ticker or name and sees the company's key numbers (revenue, margins, cash flow, debt) for the last five fiscal years and four quarters, measured the same way for every company. Every number opens its source: the exact SEC filing, period and line item, and derived numbers such as margins show their formula. The page ranks the company's margins against its industry peers. An AI brief summarizes recent 8-K filings and news headlines, and every claim in it cites a source id; a checker verifies the cited numbers before the claim is shown. Signed-in users keep a private watchlist that flags new filings and big changes, and an admin can fix how a metric is mapped for a company. The data comes from SEC EDGAR (public data) and GDELT news headlines (terms allow public use; headlines and links only). FinLens explains companies but never predicts prices or gives investment advice, and a disclaimer is always shown.

User Stories:

1. As an investor, I want to type a ticker or a company name and land on that company's page, so that I don't need to know SEC ids or browse EDGAR.
2. As an investor, I want a company's key numbers for the last five fiscal years and four quarters, measured the same way for every company, so that I can see the trend without reading the filings.
3. As an investor who doesn't trust numbers blindly, I want to see which filing, period and line item each number came from, so that I can check it myself.
4. As an investor, I want derived numbers, such as an unreported fourth quarter or a margin, to be clearly marked with their formula, so that I know what was reported and what was calculated.
5. As an investor, I want to see how a company's margins rank in its industry, so that I know whether a number is good or bad for that kind of business.
6. As an investor, I want a short summary of recent events with a source for every claim, so that I can catch up quickly and still check everything.
7. As a signed-in investor, I want a private watchlist that tells me what changed since my last visit, so that I don't have to check every company by hand.
8. As the site admin, I want to see data-quality problems and fix how a metric is mapped for a company, so that wrong numbers don't reach users.
