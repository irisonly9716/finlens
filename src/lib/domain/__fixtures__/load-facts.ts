// Test helper: map a companyfacts fixture (SEC JSON shape) to domain XbrlFacts.
// The fixtures are excerpts of https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json
// (Apple 0000320193, JPMorgan Chase 0000019617), downloaded 2026-11-23 and trimmed to
// the us-gaap USD facts F2 uses, ending on or after 2016-09-01, plus Apple's
// null-fy 8-K recast cash facts. SEC key order and field values are unchanged.
import type { XbrlFact } from "../xbrl-facts";

interface FixtureFact {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy: number | null;
  fp: string | null;
  form: string;
  filed: string;
  frame?: string;
}

export interface CompanyFactsFixture {
  cik: number;
  entityName: string;
  facts: { "us-gaap": Record<string, { label: string; units: { USD: FixtureFact[] } }> };
}

export function factsOf(json: CompanyFactsFixture, concept: string): XbrlFact[] {
  const rows = json.facts["us-gaap"][concept]?.units.USD ?? [];
  return rows.map((f) => ({
    concept,
    start: f.start ?? null,
    end: f.end,
    val: f.val,
    accn: f.accn,
    fy: f.fy,
    fp: f.fp,
    form: f.form,
    filed: f.filed,
    frame: f.frame ?? null,
  }));
}

export function allFacts(json: CompanyFactsFixture): XbrlFact[] {
  return Object.keys(json.facts["us-gaap"]).flatMap((concept) => factsOf(json, concept));
}
