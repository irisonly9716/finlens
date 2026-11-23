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

/** Learn fiscal year-ends from each 10-K's own period (not its comparatives). */
export function buildFiscalCalendar(facts: readonly XbrlFact[]): FiscalCalendar {
  void facts;
  return { yearEnds: [] }; // RED stub
}

/** Label one fact (or any start/end pair) with its fiscal period. */
export function fiscalPeriodOf(
  fact: Pick<XbrlFact, "start" | "end">,
  calendar: FiscalCalendar,
): FiscalPeriodResult {
  void fact;
  void calendar;
  return { period: { fy: 0, fp: "FY", instant: false, key: "" } }; // RED stub
}

export function periodKey(fy: number, fp: FiscalPeriodKind): string {
  void fy;
  void fp;
  return ""; // RED stub
}
