// F2-1 metric definitions: the reported inputs of the canonical metrics, each with
// an ordered list of us-gaap concepts. Derived metrics (margins, free cash flow,
// ratios, total debt) are computed in F2-4 (metrics.ts). Pure data.

export type ReportedMetric =
  | "revenue"
  | "cost_of_revenue"
  | "gross_profit"
  | "operating_income"
  | "net_income"
  | "operating_cash_flow"
  | "capex"
  | "cash"
  | "stockholders_equity"
  | "long_term_debt"
  | "long_term_debt_current"
  | "long_term_debt_noncurrent"
  | "commercial_paper";

/** For each period, the first concept in the list with a value wins. */
export const CONCEPT_LISTS: Readonly<Record<ReportedMetric, readonly string[]>> = {
  revenue: [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueNet",
  ],
  cost_of_revenue: ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"],
  gross_profit: ["GrossProfit"],
  operating_income: ["OperatingIncomeLoss"],
  net_income: ["NetIncomeLoss"],
  operating_cash_flow: [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
  ],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
  cash: ["CashAndCashEquivalentsAtCarryingValue", "Cash"],
  stockholders_equity: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
  // Total debt components (F2-4): LongTermDebt includes its current portion.
  long_term_debt: ["LongTermDebt"],
  long_term_debt_current: ["LongTermDebtCurrent"],
  long_term_debt_noncurrent: ["LongTermDebtNoncurrent"],
  commercial_paper: ["CommercialPaper"],
};
