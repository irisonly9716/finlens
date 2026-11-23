// F2-5 restatements: one value per concept and fiscal period, taken from the latest
// filing; earlier filings' values stay available as history. Pure; no I/O.
import { fiscalPeriodOf, type FiscalCalendar, type FiscalPeriod } from "./fiscal-periods";
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
  const groups = new Map<string, { concept: string; period: FiscalPeriod; facts: XbrlFact[] }>();
  for (const fact of facts) {
    if (!STATEMENT_FORMS.includes(fact.form)) continue;
    const { period } = fiscalPeriodOf(fact, calendar);
    if (period === null) continue;
    const id = `${fact.concept}|${period.key}`;
    const group = groups.get(id);
    if (group) group.facts.push(fact);
    else groups.set(id, { concept: fact.concept, period, facts: [fact] });
  }
  return [...groups.values()].map(({ concept, period, facts: group }) => {
    const [fact, ...history] = [...group].sort(newestFirst);
    return { concept, period, fact, history };
  });
}

/** Latest filing date first; same day → higher accession number first (deterministic). */
function newestFirst(a: XbrlFact, b: XbrlFact): number {
  return b.filed.localeCompare(a.filed) || b.accn.localeCompare(a.accn);
}
