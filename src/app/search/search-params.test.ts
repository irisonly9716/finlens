import { describe, expect, it } from "vitest";
import { MAX_QUERY_LENGTH, parseSearchQuery } from "./search-params";

describe("search params", () => {
  it("reads and trims q", () => {
    expect(parseSearchQuery({ q: "  aapl " })).toBe("aapl");
  });

  it("missing q → empty query", () => {
    expect(parseSearchQuery({})).toBe("");
    expect(parseSearchQuery({ q: undefined })).toBe("");
  });

  it("repeated q uses the first value", () => {
    expect(parseSearchQuery({ q: ["msft", "aapl"] })).toBe("msft");
    expect(parseSearchQuery({ q: [] })).toBe("");
  });

  it(`caps q at ${MAX_QUERY_LENGTH} characters`, () => {
    expect(parseSearchQuery({ q: "a".repeat(500) })).toHaveLength(MAX_QUERY_LENGTH);
  });

  it("ignores unrelated params", () => {
    expect(parseSearchQuery({ q: "apple", page: "2" })).toBe("apple");
  });
});
