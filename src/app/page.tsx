import type { JSX } from "react";
import { SearchForm } from "@/components/SearchForm";

export default function Home(): JSX.Element {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">FinLens</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Source-traceable financial metrics for US public companies, from SEC filings.
      </p>
      <SearchForm />
    </main>
  );
}
