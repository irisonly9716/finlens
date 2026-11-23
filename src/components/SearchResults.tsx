import Link from "next/link";
import type { JSX } from "react";
import type { CompanyEntry, SearchResult } from "@/lib/domain/company-search";

export function companyHref(company: Pick<CompanyEntry, "ticker">): string {
  return `/company/${encodeURIComponent(company.ticker)}`;
}

function CompanyList({
  companies,
  label,
}: {
  companies: readonly CompanyEntry[];
  label: string;
}): JSX.Element {
  return (
    <ul aria-label={label} className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {companies.map((c) => (
        <li key={c.ticker}>
          <Link
            href={companyHref(c)}
            className="flex items-baseline gap-3 py-2 hover:bg-zinc-50 focus-visible:outline-2 dark:hover:bg-zinc-900"
          >
            <span className="w-16 font-mono font-semibold">{c.ticker}</span>
            <span className="flex-1">{c.name}</span>
            <span className="text-sm text-zinc-500">CIK {c.cik}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Renders a search outcome: matches (F1-2) or the empty state with suggestions (F1-3). */
export function SearchResults({
  query,
  result,
}: {
  query: string;
  result: SearchResult;
}): JSX.Element {
  switch (result.kind) {
    case "empty_query":
      return <p>Enter a ticker (e.g. AAPL) or the start of a company name.</p>;

    case "exact":
      return <CompanyList companies={[result.company]} label="Search results" />;

    case "matches":
      return (
        <section>
          <h2 className="mb-2 text-lg font-semibold">
            {result.companies.length} {result.companies.length === 1 ? "match" : "matches"} for “
            {query}”
          </h2>
          <CompanyList companies={result.companies} label="Search results" />
        </section>
      );

    case "no_match":
      return (
        <section>
          <h2 className="mb-2 text-lg font-semibold">No company matches “{query}”</h2>
          {result.suggestions.length > 0 ? (
            <>
              <p className="mb-2">Did you mean:</p>
              <CompanyList companies={result.suggestions} label="Suggestions" />
            </>
          ) : (
            <p>Check the spelling, or try a ticker like AAPL or the start of a company name.</p>
          )}
        </section>
      );
  }
}
