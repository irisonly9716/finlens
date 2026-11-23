// F2-6 consistency check: when gross profit and cost of revenue are both reported,
// |revenue − cost of revenue − gross profit| must be within 0.5% of revenue;
// otherwise the period gets a data-quality flag (listed for admins in F7-1). Pure; no I/O.
import type { ConceptOverrides, ResolvedValue } from "./concept-resolution";
import type { MetricReason } from "./metrics";
import type { PeriodValue } from "./restatements";

/** Allowed |revenue − cost of revenue − gross profit|, as a share of revenue. */
export const GROSS_PROFIT_TOLERANCE = 0.005;

export type ConsistencyCheck =
  | {
      key: string;
      checked: true;
      flagged: boolean;
      /** revenue − cost of revenue − gross profit. */
      difference: number;
      /** GROSS_PROFIT_TOLERANCE × |revenue|. */
      limit: number;
      inputs: { revenue: ResolvedValue; cost_of_revenue: ResolvedValue; gross_profit: ResolvedValue };
      reason?: never;
    }
  | { key: string; checked: false; flagged: false; reason: MetricReason };

/** The gross-profit check for one period key. */
export function checkGrossProfit(
  values: readonly PeriodValue[],
  key: string,
  overrides: ConceptOverrides = {},
): ConsistencyCheck {
  void values;
  void overrides;
  return { key, checked: false, flagged: false, reason: "missing_input:stub" }; // RED stub
}

/** Every flagged period in `values`. */
export function dataQualityFlags(
  values: readonly PeriodValue[],
  overrides: ConceptOverrides = {},
): ConsistencyCheck[] {
  void values;
  void overrides;
  return []; // RED stub
}
