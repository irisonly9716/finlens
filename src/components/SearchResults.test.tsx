// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import fixture from "@/lib/domain/__fixtures__/company-tickers.json";
import { buildCompanyIndex, searchCompanies } from "@/lib/domain/company-search";
import { SearchResults } from "./SearchResults";

const index = buildCompanyIndex(
  Object.values(fixture).map((r) => ({ cik: r.cik_str, ticker: r.ticker, name: r.title })),
);

function renderSearch(query: string): void {
  render(<SearchResults query={query} result={searchCompanies(index, query)} />);
}

afterEach(cleanup);

describe("SearchResults", () => {
  it("F1-2: lists name prefix matches with links to the company page", () => {
    renderSearch("apple");
    const list = screen.getByRole("list", { name: "Search results" });
    const links = within(list).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/company/AAPL",
      "/company/APLE",
    ]);
    expect(links[0].textContent).toContain("Apple Inc.");
    expect(links[0].textContent).toContain("CIK 0000320193");
    expect(screen.getByRole("heading").textContent).toContain("2 matches");
  });

  it("F1-3: unknown query shows an empty state with suggestions, not an error", () => {
    renderSearch("MSFY");
    expect(screen.getByRole("heading").textContent).toBe("No company matches “MSFY”");
    const suggestions = screen.getByRole("list", { name: "Suggestions" });
    expect(within(suggestions).getByRole("link").getAttribute("href")).toBe("/company/MSFT");
    expect(document.body.textContent).not.toMatch(/error/i);
  });

  it("F1-3: empty state without suggestions gives a hint", () => {
    renderSearch("ZZZZZZ");
    expect(screen.queryByRole("list")).toBeNull();
    expect(document.body.textContent).toContain("Check the spelling");
  });

  it("links tickers with punctuation safely (BRK-B)", () => {
    renderSearch("berkshire");
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/company/BRK-B", "/company/BRK-A"]);
  });

  it("blank query prompts for input", () => {
    renderSearch("");
    expect(document.body.textContent).toContain("Enter a ticker");
  });
});
