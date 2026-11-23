// F2-4 canonical metrics for one fiscal period: reported metrics come from concept
// resolution (F2-1), Q4 flows from derived Q4 (F2-2), and derived metrics (margins,
// free cash flow, total debt, debt-to-equity) from their inputs. A metric that cannot
// be computed is null with a reason, never 0. Pure; no I/O.
import type { ConceptOverrides, ResolvedValue } from "./concept-resolution";
import type { DerivedQ4 } from "./derived-q4";
import type { PeriodValue } from "./restatements";

export type CanonicalMetric =
  | "revenue"
  | "gross_profit"
  | "gross_margin"
  | "operating_income"
  | "operating_margin"
  | "net_income"
  | "net_margin"
  | "operating_cash_flow"
  | "free_cash_flow"
  | "cash"
  | "total_debt"
  | "debt_to_equity";

export type MetricReason = "no_data" | `missing_input:${string}`;

/** A reported value (F2-1) or a derived Q4 (F2-2), for source drill-down (F3). */
export type MetricInput = ResolvedValue | DerivedQ4;

interface MetricBase {
  metric: CanonicalMetric;
  /** Period key, e.g. "FY2024" or "FY2024Q4". */
  key: string;
  /** Formula over input names for derived metrics (F3-2); null for reported ones. */
  formula: string | null;
  /** The inputs found, by name. */
  inputs: Record<string, MetricInput>;
}

export type MetricResult = MetricBase &
  ({ value: number; reason?: never } | { value: null; reason: MetricReason });

/** All canonical metrics for one period key, from the output of F2-5. */
export function computeMetrics(
  values: readonly PeriodValue[],
  key: string,
  overrides: ConceptOverrides = {},
): Record<CanonicalMetric, MetricResult> {
  void values;
  void overrides;
  const stub = (metric: CanonicalMetric): MetricResult => ({
    metric,
    key,
    formula: null,
    inputs: {},
    value: null,
    reason: "missing_input:stub",
  }); // RED stub
  return {
    revenue: stub("revenue"),
    gross_profit: stub("gross_profit"),
    gross_margin: stub("gross_margin"),
    operating_income: stub("operating_income"),
    operating_margin: stub("operating_margin"),
    net_income: stub("net_income"),
    net_margin: stub("net_margin"),
    operating_cash_flow: stub("operating_cash_flow"),
    free_cash_flow: stub("free_cash_flow"),
    cash: stub("cash"),
    total_debt: stub("total_debt"),
    debt_to_equity: stub("debt_to_equity"),
  };
}
