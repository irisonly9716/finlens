// F2-5 restatements: one value per concept and fiscal period, taken from the latest
// filing; earlier filings' values stay available as history. Pure; no I/O.
import type { FiscalCalendar, FiscalPeriod } from "./fiscal-periods";
import type { XbrlFact } from "./xbrl-facts";

/**
 * Forms whose XBRL facts are financial statements (8-K: recast statements in
 * exhibits). Others, e.g. DEF 14A proxies, repeat figures rounded and never win.
 */
export const STATEMENT_FORMS: readonly string[] = [
  "10-K",
  "10-K/A",
  "10-KT",
  "10-Q",
  "10-Q/A",
  "8-K",
  "8-K/A",
];

export interface PeriodValue {
  concept: string;
  period: FiscalPeriod;
  /** The fact from the latest filing: the value shown, and its source. */
  fact: XbrlFact;
  /** The same concept and period from earlier filings, newest first. */
  history: XbrlFact[];
}

/** Collapse facts to one PeriodValue per concept and fiscal period (latest filing wins). */
export function latestByPeriod(
  facts: readonly XbrlFact[],
  calendar: FiscalCalendar,
): PeriodValue[] {
  void facts;
  void calendar;
  return []; // RED stub
}
