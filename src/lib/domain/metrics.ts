// F2-4 canonical metrics for one fiscal period: reported metrics come from concept
// resolution (F2-1), Q4 flows from derived Q4 (F2-2), and derived metrics (margins,
// free cash flow, total debt, debt-to-equity) from their inputs. A metric that cannot
// be computed is null with a reason, never 0. Pure; no I/O.
import { resolveMetric, type ConceptOverrides, type ResolvedValue } from "./concept-resolution";
import { deriveQ4, type DerivedQ4 } from "./derived-q4";
import type { ReportedMetric } from "./metric-definitions";
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
  const q4 = /^FY(\d+)Q4$/.exec(key);

  // A reported input for this period; at fiscal Q4, a derived Q4 flow (F2-2) or
  // the year-end balance (the FY instant) stands in for an unreported Q4.
  const input = (metric: ReportedMetric): MetricInput | undefined => {
    const resolved = resolveMetric(metric, values, overrides);
    const reported = resolved.find((r) => r.period.key === key);
    if (reported || !q4) return reported;
    return (
      deriveQ4(resolved).find((d) => d.period.key === key) ??
      resolved.find((r) => r.period.key === `FY${q4[1]}` && r.period.instant)
    );
  };

  const reported = (metric: ReportedMetric & CanonicalMetric): MetricResult => {
    const found = input(metric);
    const base = { metric, key, formula: null };
    return found
      ? { ...base, inputs: { [metric]: found }, value: found.value }
      : { ...base, inputs: {}, value: null, reason: "no_data" };
  };

  const derived = (
    metric: CanonicalMetric,
    names: readonly ReportedMetric[],
    formula: string,
    compute: (v: number[]) => number,
  ): MetricResult => {
    const inputs: Record<string, MetricInput> = {};
    for (const name of names) {
      const found = input(name);
      if (found) inputs[name] = found;
    }
    const base = { metric, key, formula, inputs };
    const missing = names.find((name) => !inputs[name]);
    if (missing) return { ...base, value: null, reason: `missing_input:${missing}` };
    return { ...base, value: compute(names.map((name) => inputs[name]!.value)) };
  };

  const totalDebt = ((): MetricResult => {
    const longTermDebt = input("long_term_debt");
    const current = input("long_term_debt_current");
    const noncurrent = input("long_term_debt_noncurrent");
    const commercialPaper = input("commercial_paper");
    const terms: Record<string, MetricInput> | undefined = longTermDebt
      ? { long_term_debt: longTermDebt }
      : current && noncurrent
        ? { long_term_debt_current: current, long_term_debt_noncurrent: noncurrent }
        : undefined;
    if (!terms) {
      return {
        metric: "total_debt",
        key,
        formula: null,
        inputs: {},
        value: null,
        reason: "missing_input:long_term_debt",
      };
    }
    const inputs = commercialPaper ? { ...terms, commercial_paper: commercialPaper } : terms;
    return {
      metric: "total_debt",
      key,
      formula: Object.keys(inputs).join(" + "),
      inputs,
      value: Object.values(inputs).reduce((sum, i) => sum + i.value, 0),
    };
  })();

  const equity = input("stockholders_equity");
  const debtToEquity: MetricResult = {
    metric: "debt_to_equity",
    key,
    formula: "total_debt / stockholders_equity",
    inputs: { ...totalDebt.inputs, ...(equity ? { stockholders_equity: equity } : {}) },
    ...(totalDebt.value === null
      ? { value: null, reason: "missing_input:total_debt" as const }
      : equity
        ? { value: totalDebt.value / equity.value }
        : { value: null, reason: "missing_input:stockholders_equity" as const }),
  };

  const ratio = (a: number[]): number => a[0]! / a[1]!;
  return {
    revenue: reported("revenue"),
    gross_profit: reported("gross_profit"),
    gross_margin: derived("gross_margin", ["gross_profit", "revenue"], "gross_profit / revenue", ratio),
    operating_income: reported("operating_income"),
    operating_margin: derived(
      "operating_margin",
      ["operating_income", "revenue"],
      "operating_income / revenue",
      ratio,
    ),
    net_income: reported("net_income"),
    net_margin: derived("net_margin", ["net_income", "revenue"], "net_income / revenue", ratio),
    operating_cash_flow: reported("operating_cash_flow"),
    free_cash_flow: derived(
      "free_cash_flow",
      ["operating_cash_flow", "capex"],
      "operating_cash_flow − capex",
      (a) => a[0]! - a[1]!,
    ),
    cash: reported("cash"),
    total_debt: totalDebt,
    debt_to_equity: debtToEquity,
  };
}
