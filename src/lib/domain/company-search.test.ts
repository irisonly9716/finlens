import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/company-tickers.json";
import {
  buildCompanyIndex,
  padCik,
  searchCompanies,
  suggestCompanies,
  type CompanyEntry,
  type TickerRow,
} from "./company-search";

// The fixture is a 15-row excerpt of https://www.sec.gov/files/company_tickers.json
// (keys and order as in the SEC file). Map it to the domain's TickerRow shape.
const fixtureRows: TickerRow[] = Object.values(fixture).map((r) => ({
  cik: r.cik_str,
  ticker: r.ticker,
  name: r.title,
}));
const index = buildCompanyIndex(fixtureRows);

function exactTicker(query: string): CompanyEntry | null {
  const result = searchCompanies(index, query);
  return result.kind === "exact" ? result.company : null;
}

describe("F1-1 ticker lookup", () => {
  it("F1-1: padCik pads the CIK to 10 digits", () => {
    expect(padCik(320193)).toBe("0000320193");
    expect(padCik(6951)).toBe("0000006951");
    expect(padCik(1234567890)).toBe("1234567890");
  });

  it("F1-1: ticker match is case-insensitive and resolves to the CIK", () => {
    for (const query of ["AAPL", "aapl", "AaPl", "  aapl  "]) {
      const company = exactTicker(query);
      expect(company?.ticker).toBe("AAPL");
      expect(company?.cik).toBe("0000320193");
      expect(company?.name).toBe("Apple Inc.");
    }
  });

  it("F1-1: ignores punctuation and spaces (BRK.B, brk b, BRK-B, brkb → BRK-B)", () => {
    for (const query of ["BRK.B", "brk b", "BRK-B", "brkb", "brk/b"]) {
      const company = exactTicker(query);
      expect(company?.ticker).toBe("BRK-B");
      expect(company?.cik).toBe("0001067983");
    }
    expect(exactTicker("brk.a")?.ticker).toBe("BRK-A");
  });

  it("F1-1: keeps both tickers of one company (GOOG and GOOGL share a CIK)", () => {
    expect(exactTicker("goog")?.ticker).toBe("GOOG");
    expect(exactTicker("googl")?.ticker).toBe("GOOGL");
    expect(exactTicker("goog")?.cik).toBe(exactTicker("googl")?.cik);
  });

  it("F1-1: duplicate ticker rows keep the first (SEC file order)", () => {
    const dupIndex = buildCompanyIndex([
      { cik: 111, ticker: "DUP", name: "First Co" },
      { cik: 222, ticker: "dup", name: "Second Co" },
    ]);
    expect(dupIndex).toHaveLength(1);
    const result = searchCompanies(dupIndex, "dup");
    expect(result).toEqual({
      kind: "exact",
      company: expect.objectContaining({ cik: "0000000111", name: "First Co" }),
    });
  });

  it("F1-1: a blank or punctuation-only query is empty_query, not an error", () => {
    for (const query of ["", "   ", "--.."]) {
      expect(searchCompanies(index, query)).toEqual({ kind: "empty_query" });
    }
  });
});

function matchTickers(idx: readonly CompanyEntry[], query: string): string[] | null {
  const result = searchCompanies(idx, query);
  return result.kind === "matches" ? result.companies.map((c) => c.ticker) : null;
}

describe("F1-2 name prefix search", () => {
  it("F1-2: name prefix ignores case and punctuation", () => {
    expect(matchTickers(index, "apple")).toEqual(["AAPL", "APLE"]);
    expect(matchTickers(index, "APPLE INC")).toEqual(["AAPL"]);
    expect(matchTickers(index, "Apple Inc.")).toEqual(["AAPL"]);
    expect(matchTickers(index, "apple   hospitality reit inc")).toEqual(["APLE"]);
    expect(matchTickers(index, "applied materials inc de")).toEqual(["AMAT"]);
  });

  it("F1-2: keeps SEC file order within name matches", () => {
    expect(matchTickers(index, "appl")).toEqual([
      "AAPL",
      "AMAT",
      "APP",
      "AIT",
      "APLE",
      "APLD",
      "AAOI",
      "AERGP",
    ]);
  });

  it("F1-2: ranks ticker prefix matches above name prefix matches, without duplicates", () => {
    // Ticker prefix "AP": APH, APP, APLE, APLD. Name prefix "ap" adds the rest;
    // AppLovin (APP), Apple Hospitality (APLE) and Applied Digital (APLD) match
    // both ways but appear once, in the ticker group.
    expect(matchTickers(index, "ap")).toEqual([
      "APH",
      "APP",
      "APLE",
      "APLD",
      "AAPL",
      "AMAT",
      "AIT",
      "AAOI",
      "AERGP",
    ]);
  });

  it("F1-2: returns at most 10 matches", () => {
    const many = buildCompanyIndex(
      Array.from({ length: 15 }, (_, i) => ({
        cik: 1000 + i,
        ticker: `X${i + 1}`,
        name: `Acme Holdings ${i + 1}`,
      })),
    );
    const tickers = matchTickers(many, "acme");
    expect(tickers).toHaveLength(10);
    expect(tickers).toEqual(Array.from({ length: 10 }, (_, i) => `X${i + 1}`));
  });

  it("F1-2: matches prefixes only, not substrings", () => {
    expect(searchCompanies(index, "materials").kind).toBe("no_match");
    expect(searchCompanies(index, "corp").kind).toBe("no_match");
  });
});

function suggestionTickers(query: string): string[] | null {
  const result = searchCompanies(index, query);
  return result.kind === "no_match" ? result.suggestions.map((c) => c.ticker) : null;
}

describe("F1-3 suggestions for unknown queries", () => {
  it("F1-3: APPL suggests AAPL (edit distance 1)", () => {
    const tickers = suggestCompanies(index, "APPL").map((c) => c.ticker);
    expect(tickers[0]).toBe("AAPL");
  });

  it("F1-3: covers substitution, insertion and deletion", () => {
    expect(suggestionTickers("MSFY")).toEqual(["MSFT"]); // substitution
    expect(suggestionTickers("MSFTT")).toEqual(["MSFT"]); // extra letter typed
    expect(suggestionTickers("msft x")).toEqual(["MSFT"]); // punctuation ignored first
    expect(suggestCompanies(index, "AAL").map((c) => c.ticker)).toContain("AAPL"); // missing letter
  });

  it("F1-3: distance-1 tickers come first (SEC order), then ticker/name prefix matches", () => {
    // Distance 1 from APPL: AAPL (substitution), APP (deletion). Then name prefix
    // "appl" in file order, skipping the two already listed.
    expect(suggestCompanies(index, "APPL").map((c) => c.ticker)).toEqual([
      "AAPL",
      "APP",
      "AMAT",
      "AIT",
      "APLE",
    ]);
  });

  it("F1-3: returns at most 5 suggestions", () => {
    const many = buildCompanyIndex(
      Array.from({ length: 9 }, (_, i) => ({
        cik: 2000 + i,
        ticker: `QZ${i + 1}`,
        name: `Quartz ${i + 1}`,
      })),
    );
    // "QZ" is distance 1 from every "QZn" ticker.
    expect(suggestCompanies(many, "QZ")).toHaveLength(5);
  });

  it("F1-3: unknown query returns no_match with suggestions, never throws", () => {
    expect(searchCompanies(index, "BRK.C")).toEqual({
      kind: "no_match",
      suggestions: [
        expect.objectContaining({ ticker: "BRK-B" }),
        expect.objectContaining({ ticker: "BRK-A" }),
      ],
    });
    expect(searchCompanies(index, "ZZZZZZ")).toEqual({ kind: "no_match", suggestions: [] });
    expect(suggestCompanies(index, "")).toEqual([]);
  });
});
