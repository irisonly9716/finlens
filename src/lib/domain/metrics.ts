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

type Inputs = Record<string, MetricInput>;

/** A named value inside a formula: a reported input or another computed metric. */
interface Operand {
  name: string;
  value: number | null;
  inputs: Inputs;
}

const OPERATIONS = {
  "/": (a: number, b: number): number => a / b,
  "−": (a: number, b: number): number => a - b,
} as const;

/** All canonical metrics for one period key, from the output of F2-5. */
export function computeMetrics(
  values: readonly PeriodValue[],
  key: string,
  overrides: ConceptOverrides = {},
): Record<CanonicalMetric, MetricResult> {
  const q4 = /^FY(\d+)Q4$/.exec(key);
  const cache = new Map<ReportedMetric, MetricInput | undefined>();

  // A reported input for this period; at fiscal Q4, a derived Q4 flow (F2-2) or
  // the year-end balance (the FY instant) stands in for an unreported Q4.
  const lookup = (metric: ReportedMetric): MetricInput | undefined => {
    const resolved = resolveMetric(metric, values, overrides);
    const reported = resolved.find((r) => r.period.key === key);
    if (reported || !q4) return reported;
    return (
      deriveQ4(resolved).find((d) => d.period.key === key) ??
      resolved.find((r) => r.period.key === `FY${q4[1]}` && r.period.instant)
    );
  };
  const input = (metric: ReportedMetric): MetricInput | undefined => {
    if (!cache.has(metric)) cache.set(metric, lookup(metric));
    return cache.get(metric);
  };
  const operand = (name: ReportedMetric): Operand => {
    const found = input(name);
    return { name, value: found?.value ?? null, inputs: found ? { [name]: found } : {} };
  };

  const result = (
    metric: CanonicalMetric,
    formula: string | null,
    inputs: Inputs,
    outcome: number | MetricReason,
  ): MetricResult =>
    typeof outcome === "number"
      ? { metric, key, formula, inputs, value: outcome }
      : { metric, key, formula, inputs, value: null, reason: outcome };

  const reported = (metric: ReportedMetric & CanonicalMetric): MetricResult => {
    const { value, inputs } = operand(metric);
    return result(metric, null, inputs, value ?? "no_data");
  };

  // `a op b`; null with the first missing operand's name.
  const binary = (
    metric: CanonicalMetric,
    a: Operand,
    op: keyof typeof OPERATIONS,
    b: Operand,
  ): MetricResult => {
    const inputs = { ...a.inputs, ...b.inputs };
    const formula = `${a.name} ${op} ${b.name}`;
    if (a.value === null) return result(metric, formula, inputs, `missing_input:${a.name}`);
    if (b.value === null) return result(metric, formula, inputs, `missing_input:${b.name}`);
    return result(metric, formula, inputs, OPERATIONS[op](a.value, b.value));
  };

  // Term debt (LongTermDebt, else current + noncurrent) plus commercial paper when reported.
  const totalDebt = ((): MetricResult => {
    const longTermDebt = input("long_term_debt");
    const current = input("long_term_debt_current");
    const noncurrent = input("long_term_debt_noncurrent");
    const commercialPaper = input("commercial_paper");
    const terms: Inputs | undefined = longTermDebt
      ? { long_term_debt: longTermDebt }
      : current && noncurrent
        ? { long_term_debt_current: current, long_term_debt_noncurrent: noncurrent }
        : undefined;
    if (!terms) return result("total_debt", null, {}, "missing_input:long_term_debt");
    const inputs = commercialPaper ? { ...terms, commercial_paper: commercialPaper } : terms;
    const sum = Object.values(inputs).reduce((total, i) => total + i.value, 0);
    return result("total_debt", Object.keys(inputs).join(" + "), inputs, sum);
  })();

  const revenue = operand("revenue");
  return {
    revenue: reported("revenue"),
    gross_profit: reported("gross_profit"),
    gross_margin: binary("gross_margin", operand("gross_profit"), "/", revenue),
    operating_income: reported("operating_income"),
    operating_margin: binary("operating_margin", operand("operating_income"), "/", revenue),
    net_income: reported("net_income"),
    net_margin: binary("net_margin", operand("net_income"), "/", revenue),
    operating_cash_flow: reported("operating_cash_flow"),
    free_cash_flow: binary("free_cash_flow", operand("operating_cash_flow"), "−", operand("capex")),
    cash: reported("cash"),
    total_debt: totalDebt,
    debt_to_equity: binary(
      "debt_to_equity",
      { name: "total_debt", value: totalDebt.value, inputs: totalDebt.inputs },
      "/",
      operand("stockholders_equity"),
    ),
  };
}
