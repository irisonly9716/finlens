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

/**
 * Lowercase, turn punctuation into spaces, collapse whitespace:
 * "APPLIED MATERIALS INC /DE" → "applied materials inc de".
 */
export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const MAX_MATCHES = 10;

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
      nameKey: normalizeName(row.name),
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

  const nameQuery = normalizeName(query);
  const tickerHits = index.filter((c) => c.tickerKey.startsWith(tickerQuery));
  const inTickerHits = new Set(tickerHits);
  const nameHits = index.filter(
    (c) => nameQuery !== "" && c.nameKey.startsWith(nameQuery) && !inTickerHits.has(c),
  );
  const companies = [...tickerHits, ...nameHits].slice(0, MAX_MATCHES);
  if (companies.length > 0) return { kind: "matches", companies };

  return { kind: "no_match", suggestions: suggestCompanies(index, query) };
}

const MAX_SUGGESTIONS = 5;

/** True when a and b differ by exactly one insertion, deletion or substitution. */
function isOneEditApart(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  // Skip the first difference: substitution when lengths match, else insertion.
  const restShort = short.length === long.length ? short.slice(i + 1) : short.slice(i);
  return restShort === long.slice(i + 1);
}

/**
 * F1-3 suggestions: tickers one edit away from the query (APPL → AAPL), then ticker
 * prefix matches, then name prefix matches; SEC file order within each group, no
 * duplicates, at most 5.
 */
export function suggestCompanies(
  index: readonly CompanyEntry[],
  query: string,
): CompanyEntry[] {
  const tickerQuery = normalizeTicker(query);
  const nameQuery = normalizeName(query);
  if (tickerQuery === "" && nameQuery === "") return [];

  const groups = [
    index.filter((c) => tickerQuery !== "" && isOneEditApart(c.tickerKey, tickerQuery)),
    index.filter((c) => tickerQuery !== "" && c.tickerKey.startsWith(tickerQuery)),
    index.filter((c) => nameQuery !== "" && c.nameKey.startsWith(nameQuery)),
  ];
  const seen = new Set<CompanyEntry>();
  const suggestions: CompanyEntry[] = [];
  for (const company of groups.flat()) {
    if (seen.has(company)) continue;
    seen.add(company);
    suggestions.push(company);
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  return suggestions;
}
