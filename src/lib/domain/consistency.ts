// F2-6 consistency check: when gross profit and cost of revenue are both reported,
// |revenue − cost of revenue − gross profit| must be within 0.5% of revenue;
// otherwise the period gets a data-quality flag (listed for admins in F7-1). Pure; no I/O.
import { resolveMetric, type ConceptOverrides, type ResolvedValue } from "./concept-resolution";
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

const INPUTS = ["revenue", "cost_of_revenue", "gross_profit"] as const;
type CheckInput = (typeof INPUTS)[number];

/** Each input metric resolved once, indexed by period key. */
type ResolvedInputs = Record<CheckInput, Map<string, ResolvedValue>>;

function resolveInputs(values: readonly PeriodValue[], overrides: ConceptOverrides): ResolvedInputs {
  const byKey = (metric: CheckInput): Map<string, ResolvedValue> =>
    new Map(resolveMetric(metric, values, overrides).map((r) => [r.period.key, r]));
  return { revenue: byKey("revenue"), cost_of_revenue: byKey("cost_of_revenue"), gross_profit: byKey("gross_profit") };
}

function check(resolved: ResolvedInputs, key: string): ConsistencyCheck {
  const missing = INPUTS.find((name) => !resolved[name].has(key));
  const revenue = resolved.revenue.get(key);
  const costOfRevenue = resolved.cost_of_revenue.get(key);
  const grossProfit = resolved.gross_profit.get(key);
  if (missing || !revenue || !costOfRevenue || !grossProfit) {
    return { key, checked: false, flagged: false, reason: `missing_input:${missing}` };
  }

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

/** The gross-profit check for one period key. */
export function checkGrossProfit(
  values: readonly PeriodValue[],
  key: string,
  overrides: ConceptOverrides = {},
): ConsistencyCheck {
  return check(resolveInputs(values, overrides), key);
}

/** Every flagged period in `values`, in the order revenue periods appear. */
export function dataQualityFlags(
  values: readonly PeriodValue[],
  overrides: ConceptOverrides = {},
): ConsistencyCheck[] {
  const resolved = resolveInputs(values, overrides);
  return [...resolved.revenue.keys()].map((key) => check(resolved, key)).filter((c) => c.flagged);
}
