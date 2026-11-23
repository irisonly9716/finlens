// F2-1 metric definitions: the reported inputs of the canonical metrics, each with
// an ordered list of us-gaap concepts. Derived metrics (margins, free cash flow,
// ratios) and debt are defined in F2-4. Pure data.

export type ReportedMetric =
  | "revenue"
  | "cost_of_revenue"
  | "gross_profit"
  | "operating_income"
  | "net_income"
  | "operating_cash_flow"
  | "capex"
  | "cash"
  | "stockholders_equity";

/** For each period, the first concept in the list with a value wins. */
export const CONCEPT_LISTS: Readonly<Record<ReportedMetric, readonly string[]>> = {
  // RED stub: lists are filled in the green step.
  revenue: [],
  cost_of_revenue: [],
  gross_profit: [],
  operating_income: [],
  net_income: [],
  operating_cash_flow: [],
  capex: [],
  cash: [],
  stockholders_equity: [],
};
