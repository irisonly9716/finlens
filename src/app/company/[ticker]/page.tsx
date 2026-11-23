import { redirect } from "next/navigation";
import { Suspense, type JSX } from "react";
import { companyHref } from "@/components/SearchResults";
import { SecUnavailable } from "@/components/SecUnavailable";
import { searchCompanies, type CompanyEntry } from "@/lib/domain/company-search";
import { getCompanyIndex } from "@/lib/sources/company-index";

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment; // malformed %-escape: search for it as typed
  }
}

async function Company({ params }: { params: Promise<{ ticker: string }> }): Promise<JSX.Element> {
  const ticker = safeDecode((await params).ticker);

  let index: CompanyEntry[];
  try {
    index = await getCompanyIndex();
  } catch (error) {
    console.error("Failed to load SEC ticker file", error);
    return <SecUnavailable />;
  }

  const result = searchCompanies(index, ticker);
  // Unknown ticker → the F1-3 empty state with suggestions, not a 404.
  if (result.kind !== "exact") redirect(`/search?q=${encodeURIComponent(ticker)}`);
  const company = result.company;
  // Canonical URL uses the SEC spelling: /company/aapl → /company/AAPL, BRK.B → BRK-B.
  if (company.ticker !== ticker) redirect(companyHref(company));

  return (
    <>
      <h1 className="text-2xl font-semibold">
        {company.name} <span className="font-mono text-zinc-500">({company.ticker})</span>
      </h1>
      <p className="mt-2 text-sm text-zinc-500">CIK {company.cik}</p>
      <p className="mt-6">Key metrics are coming soon.</p>
    </>
  );
}

export default function CompanyPage({ params }: PageProps<"/company/[ticker]">): JSX.Element {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-12">
      <Suspense fallback={<p>Loading company…</p>}>
        <Company params={params} />
      </Suspense>
    </main>
  );
}
