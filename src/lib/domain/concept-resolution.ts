// F2-1 concept resolution: for each fiscal period, pick the value of the first
// concept (admin override first, then the ordered list) that has one, and record
// which concept was used. Pure; no I/O.
import type { FiscalPeriod } from "./fiscal-periods";
import type { ReportedMetric } from "./metric-definitions";
import type { PeriodValue } from "./restatements";

/** Admin overrides for one company: metric → us-gaap concept (F7-2). */
export type ConceptOverrides = Partial<Record<ReportedMetric, string>>;

export interface ResolvedValue {
  metric: ReportedMetric;
  period: FiscalPeriod;
  value: number;
  /** The us-gaap concept the value came from. */
  concept: string;
  /** True when the concept came from an admin override, not the list. */
  viaOverride: boolean;
  /** Winning fact and earlier filings (F2-5), for source drill-down (F3). */
  source: PeriodValue;
}

/** Resolve one metric across all periods present in `values` (output of F2-5). */
export function resolveMetric(
  metric: ReportedMetric,
  values: readonly PeriodValue[],
  overrides: ConceptOverrides = {},
): ResolvedValue[] {
  void metric;
  void values;
  void overrides;
  return []; // RED stub
}
