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
  return String(cik).padStart(10, "0");
}

/** Uppercase and drop everything but A–Z and 0–9: "brk.b", "BRK B", "BRK-B" → "BRKB". */
export function normalizeTicker(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Builds the search index in SEC file order; a repeated ticker keeps its first row. */
export function buildCompanyIndex(rows: readonly TickerRow[]): CompanyEntry[] {
  const seen = new Set<string>();
  const index: CompanyEntry[] = [];
  for (const row of rows) {
    const tickerKey = normalizeTicker(row.ticker);
    if (tickerKey === "" || seen.has(tickerKey)) continue;
    seen.add(tickerKey);
    index.push({
      cik: padCik(row.cik),
      ticker: row.ticker,
      name: row.name,
      tickerKey,
      nameKey: row.name.toLowerCase(),
    });
  }
  return index;
}

export function searchCompanies(
  index: readonly CompanyEntry[],
  query: string,
): SearchResult {
  const tickerQuery = normalizeTicker(query);
  if (tickerQuery === "") return { kind: "empty_query" };

  const exact = index.find((c) => c.tickerKey === tickerQuery);
  if (exact) return { kind: "exact", company: exact };

  return { kind: "no_match", suggestions: [] };
}
