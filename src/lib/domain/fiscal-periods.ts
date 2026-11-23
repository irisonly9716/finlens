// F2-3 fiscal periods: label each fact by the company's fiscal year and quarter,
// derived from the fact's own start/end dates measured against the company's
// fiscal year-end, not from the filing's fy/fp. Pure; no I/O.
import type { XbrlFact } from "./xbrl-facts";

/** One fiscal year-end learned from a 10-K's own period. */
export interface FiscalYearEnd {
  fy: number;
  /** ISO date of the last day of the fiscal year. */
  end: string;
}

export interface FiscalCalendar {
  /** Sorted by fy ascending, one entry per fiscal year. */
  yearEnds: FiscalYearEnd[];
}

/** FY = full year; Q1–Q4 = one quarter; 6M / 9M = year-to-date durations. */
export type FiscalPeriodKind = "FY" | "Q1" | "Q2" | "Q3" | "Q4" | "6M" | "9M";

export interface FiscalPeriod {
  fy: number;
  fp: FiscalPeriodKind;
  /** True for a balance-sheet value at the period's end. */
  instant: boolean;
  /** Stable key used in source ids: "FY2024", "FY2025Q1", "FY2024-9M". */
  key: string;
}

export type FiscalPeriodReason = "no_fiscal_calendar" | "unrecognized_duration";

export type FiscalPeriodResult =
  | { period: FiscalPeriod; reason?: never }
  | { period: null; reason: FiscalPeriodReason };

const DAY_MS = 86_400_000;
/** Slack for year-ends extrapolated past the learned ones (52/53-week drift). */
const EXTRAPOLATION_TOLERANCE_DAYS = 7;
const QUARTER_DAYS = 365.25 / 4;

/** Duration in days (end − start) → kind. Wide enough for 13/14-week quarters. */
const DURATIONS: readonly { min: number; max: number; kind: "Q" | "6M" | "9M" | "FY" }[] = [
  { min: 80, max: 100, kind: "Q" },
  { min: 170, max: 190, kind: "6M" },
  { min: 260, max: 285, kind: "9M" },
  { min: 350, max: 380, kind: "FY" },
];

function toDays(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function addYears(iso: string, years: number): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y + years, m - 1, d) / DAY_MS;
}

function isAnnual(fact: XbrlFact): boolean {
  if (fact.start === null) return false;
  const days = toDays(fact.end) - toDays(fact.start);
  return days >= 350 && days <= 380;
}

/** Learn fiscal year-ends from each 10-K's own period (not its comparatives). */
export function buildFiscalCalendar(facts: readonly XbrlFact[]): FiscalCalendar {
  // Per 10-K accession, its own period is the latest-ending annual duration; the
  // filing's fy names that period. Comparatives end earlier and are ignored.
  const ownPeriod = new Map<string, { fy: number; end: string; filed: string }>();
  for (const fact of facts) {
    if (!fact.form.startsWith("10-K") || fact.fy === null || !isAnnual(fact)) continue;
    const seen = ownPeriod.get(fact.accn);
    if (!seen || fact.end > seen.end) {
      ownPeriod.set(fact.accn, { fy: fact.fy, end: fact.end, filed: fact.filed });
    }
  }
  // One entry per fiscal year; a later filing (e.g. a 10-K/A) wins.
  const byFy = new Map<number, { end: string; filed: string }>();
  for (const { fy, end, filed } of ownPeriod.values()) {
    const seen = byFy.get(fy);
    if (!seen || filed > seen.filed) byFy.set(fy, { end, filed });
  }
  const yearEnds = [...byFy.entries()]
    .map(([fy, { end }]) => ({ fy, end }))
    .sort((a, b) => a.fy - b.fy);
  return { yearEnds };
}

/** Year-end of `fy` in days, learned or extrapolated from the nearest learned year. */
function yearEndOf(fy: number, yearEnds: readonly FiscalYearEnd[]): { day: number; tolerance: number } {
  const known = yearEnds.find((y) => y.fy === fy);
  if (known) return { day: toDays(known.end), tolerance: 0 };
  const below = yearEnds.filter((y) => y.fy < fy).at(-1);
  const anchor = below ?? yearEnds[0];
  return { day: addYears(anchor.end, fy - anchor.fy), tolerance: EXTRAPOLATION_TOLERANCE_DAYS };
}

/** The fiscal year whose year-end is the first on or after `day`. */
function fiscalYearOf(day: number, yearEnds: readonly FiscalYearEnd[]): number {
  const first = yearEnds[0];
  const yearsApart = Math.floor((day - toDays(first.end)) / 365.25);
  let fy = first.fy + yearsApart - 1;
  for (;;) {
    const { day: end, tolerance } = yearEndOf(fy, yearEnds);
    if (day <= end + tolerance) return fy;
    fy += 1;
  }
}

/** Label one fact (or any start/end pair) with its fiscal period. */
export function fiscalPeriodOf(
  fact: Pick<XbrlFact, "start" | "end">,
  calendar: FiscalCalendar,
): FiscalPeriodResult {
  const { yearEnds } = calendar;
  if (yearEnds.length === 0) return { period: null, reason: "no_fiscal_calendar" };

  const end = toDays(fact.end);
  const fy = fiscalYearOf(end, yearEnds);
  const quarterOfYear = (): FiscalPeriodKind => {
    const sincePriorYearEnd = end - yearEndOf(fy - 1, yearEnds).day;
    const q = Math.min(4, Math.max(1, Math.round(sincePriorYearEnd / QUARTER_DAYS)));
    return `Q${q}` as FiscalPeriodKind;
  };

  if (fact.start === null) {
    const yearEnd = yearEndOf(fy, yearEnds);
    const fp = Math.abs(end - yearEnd.day) <= yearEnd.tolerance ? "FY" : quarterOfYear();
    return { period: { fy, fp, instant: true, key: periodKey(fy, fp) } };
  }

  const days = end - toDays(fact.start);
  const match = DURATIONS.find((d) => days >= d.min && days <= d.max);
  if (!match) return { period: null, reason: "unrecognized_duration" };
  const fp = match.kind === "Q" ? quarterOfYear() : match.kind;
  return { period: { fy, fp, instant: false, key: periodKey(fy, fp) } };
}

export function periodKey(fy: number, fp: FiscalPeriodKind): string {
  if (fp === "FY") return `FY${fy}`;
  if (fp === "6M" || fp === "9M") return `FY${fy}-${fp}`;
  return `FY${fy}${fp}`;
}
