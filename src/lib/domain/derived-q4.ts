// F2-2 derived Q4: companies rarely file a Q4 10-Q, so when a fiscal year's FY
// and 9M YTD values exist but Q4 is not reported, Q4 = FY − 9M YTD, marked
// derived and linked to both inputs (F3-2). Pure; no I/O.
import type { ResolvedValue } from "./concept-resolution";
import type { FiscalPeriod } from "./fiscal-periods";
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
  void resolved;
  return []; // RED stub
}
