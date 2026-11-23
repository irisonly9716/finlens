import "server-only";
import { z } from "zod";
import type { TickerRow } from "@/lib/domain/company-search";

// SEC EDGAR adapter. Server-only: SEC has no CORS and requires a descriptive
// User-Agent with a contact email on every request (fair-access rules).

export const SEC_TICKER_FILE_URL = "https://www.sec.gov/files/company_tickers.json";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class SecFetchError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`SEC request failed with HTTP ${status}: ${url}`);
    this.name = "SecFetchError";
  }

  /** 403 / 429: SEC is throttling or rejecting us; back off rather than retry. */
  get isRateLimited(): boolean {
    return this.status === 403 || this.status === 429;
  }
}

function secUserAgent(): string {
  const ua = process.env.SEC_USER_AGENT?.trim();
  if (!ua) {
    throw new Error(
      "SEC_USER_AGENT is not set. Add it to .env.local, e.g. " +
        '"FinLens/0.1 (CS 6983 project; you@example.com)" (see .env.example).',
    );
  }
  return ua;
}

/** GET a JSON document from SEC with the required User-Agent. */
export async function secFetchJson(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { "User-Agent": secUserAgent(), Accept: "application/json" },
  });
  if (!response.ok) throw new SecFetchError(response.status, url);
  return response.json();
}

const tickerFileSchema = z.record(
  z.string(),
  z.object({
    cik_str: z.number().int().positive(),
    ticker: z.string(),
    title: z.string(),
  }),
);

/** Downloads and validates the SEC ticker file (uncached; see company-index.ts). */
export async function fetchTickerRows(fetchImpl: FetchLike = fetch): Promise<TickerRow[]> {
  const file = tickerFileSchema.parse(await secFetchJson(SEC_TICKER_FILE_URL, fetchImpl));
  // Keys are "0".."N"; integer-like keys iterate in numeric order, i.e. SEC file order.
  return Object.values(file).map((r) => ({ cik: r.cik_str, ticker: r.ticker, name: r.title }));
}
