import { redirect } from "next/navigation";
import { Suspense, type JSX } from "react";
import { SearchForm } from "@/components/SearchForm";
import { SearchResults, companyHref } from "@/components/SearchResults";
import { SecUnavailable } from "@/components/SecUnavailable";
import { searchCompanies, type CompanyEntry } from "@/lib/domain/company-search";
import { getCompanyIndex } from "@/lib/sources/company-index";
import { parseSearchQuery } from "./search-params";

export const metadata = { title: "Search · FinLens" };

type SearchParams = Record<string, string | string[] | undefined>;

async function Results({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<JSX.Element> {
  const query = parseSearchQuery(await searchParams);

  let index: CompanyEntry[];
  try {
    index = await getCompanyIndex();
  } catch (error) {
    console.error("Failed to load SEC ticker file", error);
    return <SecUnavailable />;
  }

  const result = searchCompanies(index, query);
  // F1-1: an exact ticker hit goes straight to the company page.
  if (result.kind === "exact") redirect(companyHref(result.company));

  return (
    <>
      <SearchForm defaultValue={query} />
      <div className="mt-6">
        <SearchResults query={query} result={result} />
      </div>
    </>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">): JSX.Element {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Search companies</h1>
      {/* searchParams is a runtime API: it must be read inside Suspense (cacheComponents). */}
      <Suspense fallback={<p>Searching…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
