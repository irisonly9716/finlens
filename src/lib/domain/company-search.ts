// F1 company lookup: pure search over the SEC ticker file. No I/O.

/** One row of the SEC ticker file, already validated at the adapter boundary. */
export interface TickerRow {
  cik: number;
  ticker: string;
  name: string;
}

/** A searchable company. Plain data so it can be returned from a cached function. */
export interface CompanyEntry {
  /** CIK zero-padded to 10 digits. */
  cik: string;
  /** Ticker as the SEC writes it, e.g. "BRK-B". */
  ticker: string;
  name: string;
  /** Normalized ticker used for matching, e.g. "BRKB". */
  tickerKey: string;
  /** Normalized name used for prefix matching, e.g. "apple inc". */
  nameKey: string;
}

export type SearchResult =
  | { kind: "empty_query" }
  | { kind: "exact"; company: CompanyEntry }
  | { kind: "matches"; companies: CompanyEntry[] }
  | { kind: "no_match"; suggestions: CompanyEntry[] };

export function padCik(cik: number): string {
  void cik;
  return "";
}

export function buildCompanyIndex(rows: readonly TickerRow[]): CompanyEntry[] {
  void rows;
  return [];
}

export function searchCompanies(
  index: readonly CompanyEntry[],
  query: string,
): SearchResult {
  void index;
  void query;
  return { kind: "no_match", suggestions: [] };
}
