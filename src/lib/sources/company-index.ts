import "server-only";
import { cacheLife } from "next/cache";
import { buildCompanyIndex, type CompanyEntry } from "@/lib/domain/company-search";
import { fetchTickerRows } from "./sec";

/**
 * The searchable company index, built from the SEC ticker file and cached for a day
 * (`days` profile). Plain objects only, so the result is serializable.
 */
export async function getCompanyIndex(): Promise<CompanyEntry[]> {
  "use cache";
  cacheLife("days");
  return buildCompanyIndex(await fetchTickerRows());
}
