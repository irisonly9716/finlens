// F2-2 derived Q4: companies rarely file a Q4 10-Q, so when a fiscal year's FY
// and 9M YTD values exist but Q4 is not reported, Q4 = FY − 9M YTD, marked
// derived and linked to both inputs (F3-2). Pure; no I/O.
import type { ResolvedValue } from "./concept-resolution";
import { periodKey, type FiscalPeriod } from "./fiscal-periods";
import type { ReportedMetric } from "./metric-definitions";

export const Q4_FORMULA = "FY − 9M YTD";

export interface DerivedQ4 {
  metric: ReportedMetric;
  /** fp "Q4", instant false. */
  period: FiscalPeriod;
  value: number;
  derived: true;
  formula: typeof Q4_FORMULA;
  inputs: { fy: ResolvedValue; ytd9m: ResolvedValue };
}

/** Derived Q4s for one metric's resolved values (F2-1), only where Q4 is not reported. */
export function deriveQ4(resolved: readonly ResolvedValue[]): DerivedQ4[] {
  const byKey = new Map(resolved.map((r) => [r.period.key, r]));
  const derived: DerivedQ4[] = [];
  for (const fy of resolved) {
    // Balance-sheet instants are not flows: the year-end balance is the Q4 balance.
    if (fy.period.fp !== "FY" || fy.period.instant) continue;
    const q4Key = periodKey(fy.period.fy, "Q4");
    if (byKey.has(q4Key)) continue; // reported Q4 wins
    const ytd9m = byKey.get(periodKey(fy.period.fy, "9M"));
    if (!ytd9m || ytd9m.period.instant) continue;
    derived.push({
      metric: fy.metric,
      period: { fy: fy.period.fy, fp: "Q4", instant: false, key: q4Key },
      value: fy.value - ytd9m.value,
      derived: true,
      formula: Q4_FORMULA,
      inputs: { fy, ytd9m },
    });
  }
  return derived;
}
