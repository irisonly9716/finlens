import Form from "next/form";
import type { JSX } from "react";
import { MAX_QUERY_LENGTH } from "@/app/search/search-params";

/** GET form to /search?q=... (client navigation with JS, plain form without). */
export function SearchForm({ defaultValue = "" }: { defaultValue?: string }): JSX.Element {
  return (
    <Form action="/search" role="search" className="flex w-full gap-2">
      <label htmlFor="company-search" className="sr-only">
        Ticker or company name
      </label>
      <input
        id="company-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Ticker or company name, e.g. AAPL or Apple"
        autoComplete="off"
        className="flex-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        className="rounded bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Search
      </button>
    </Form>
  );
}
