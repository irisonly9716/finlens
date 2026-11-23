// F2-6 consistency check: when gross profit and cost of revenue are both reported,
// |revenue − cost of revenue − gross profit| must be within 0.5% of revenue;
// otherwise the period gets a data-quality flag (listed for admins in F7-1). Pure; no I/O.
import { resolveMetric, type ConceptOverrides, type ResolvedValue } from "./concept-resolution";
import type { ReportedMetric } from "./metric-definitions";
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
  const at = (metric: ReportedMetric): ResolvedValue | undefined =>
    resolveMetric(metric, values, overrides).find((r) => r.period.key === key);
  const revenue = at("revenue");
  const costOfRevenue = at("cost_of_revenue");
  const grossProfit = at("gross_profit");
  if (!revenue) return { key, checked: false, flagged: false, reason: "missing_input:revenue" };
  if (!costOfRevenue) {
    return { key, checked: false, flagged: false, reason: "missing_input:cost_of_revenue" };
  }
  if (!grossProfit) return { key, checked: false, flagged: false, reason: "missing_input:gross_profit" };

  const difference = revenue.value - costOfRevenue.value - grossProfit.value;
  const limit = GROSS_PROFIT_TOLERANCE * Math.abs(revenue.value);
  return {
    key,
    checked: true,
    flagged: Math.abs(difference) > limit,
    difference,
    limit,
    inputs: { revenue, cost_of_revenue: costOfRevenue, gross_profit: grossProfit },
  };
}

/** Every flagged period in `values`. */
export function dataQualityFlags(
  values: readonly PeriodValue[],
  overrides: ConceptOverrides = {},
): ConsistencyCheck[] {
  return resolveMetric("revenue", values, overrides)
    .map((r) => checkGrossProfit(values, r.period.key, overrides))
    .filter((check) => check.flagged);
}
