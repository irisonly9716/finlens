import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "@/lib/domain/__fixtures__/company-tickers.json";
import { fetchTickerRows, SEC_TICKER_FILE_URL, SecFetchError, secFetchJson } from "./sec";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

const UA = "FinLens/0.1 (test; test@example.com)";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubEnv("SEC_USER_AGENT", UA);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("SEC adapter", () => {
  it("F1-1: requests the ticker file on www.sec.gov with the User-Agent", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(fixture));
    await fetchTickerRows(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://www.sec.gov/files/company_tickers.json");
    expect(url).toBe(SEC_TICKER_FILE_URL);
    expect(new Headers(init.headers).get("User-Agent")).toBe(UA);
  });

  it("F1-1: maps a valid ticker file to rows in SEC file order", async () => {
    const rows = await fetchTickerRows(async () => jsonResponse(fixture));
    expect(rows).toHaveLength(15);
    expect(rows[0]).toEqual({ cik: 320193, ticker: "AAPL", name: "Apple Inc." });
    expect(rows.at(-1)?.ticker).toBe("AERGP");
    expect(rows.findIndex((r) => r.ticker === "BRK-B")).toBeLessThan(
      rows.findIndex((r) => r.ticker === "BRK-A"),
    );
  });

  it("refuses to call SEC without SEC_USER_AGENT", async () => {
    vi.stubEnv("SEC_USER_AGENT", "");
    const fetchImpl = vi.fn(async () => jsonResponse(fixture));
    await expect(secFetchJson(SEC_TICKER_FILE_URL, fetchImpl)).rejects.toThrow(
      /SEC_USER_AGENT is not set/,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([403, 429])("HTTP %i → SecFetchError flagged as rate limited", async (status) => {
    const error = await secFetchJson(SEC_TICKER_FILE_URL, async () =>
      jsonResponse({}, status),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SecFetchError);
    expect((error as SecFetchError).status).toBe(status);
    expect((error as SecFetchError).isRateLimited).toBe(true);
  });

  it("HTTP 500 → SecFetchError, not rate limited", async () => {
    const error = await secFetchJson(SEC_TICKER_FILE_URL, async () =>
      jsonResponse({}, 500),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SecFetchError);
    expect((error as SecFetchError).isRateLimited).toBe(false);
  });

  it("rejects a malformed ticker file (Zod)", async () => {
    const bad = { "0": { cik_str: "320193", ticker: "AAPL", title: "Apple Inc." } };
    await expect(fetchTickerRows(async () => jsonResponse(bad))).rejects.toThrow();
  });

  it("F1-1: getCompanyIndex builds the index from the fetched file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(fixture)),
    );
    const { getCompanyIndex } = await import("./company-index");
    const index = await getCompanyIndex();
    expect(index.find((c) => c.ticker === "AAPL")?.cik).toBe("0000320193");
  });
});
