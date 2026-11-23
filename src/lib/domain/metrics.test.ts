import { describe, expect, it } from "vitest";
import apple from "./__fixtures__/aapl-companyfacts.json";
import jpm from "./__fixtures__/jpm-companyfacts.json";
import { allFacts } from "./__fixtures__/load-facts";
import { buildFiscalCalendar } from "./fiscal-periods";
import { computeMetrics, type CanonicalMetric } from "./metrics";
import { latestByPeriod } from "./restatements";

// Real data: Apple reports every input; JPMorgan (a bank) reports no gross profit,
// operating income or capex, no LongTermDebt after FY2014, cash only for FY2018, and
// CommercialPaper only through FY2017Q3.
const appleFacts = allFacts(apple);
const appleValues = latestByPeriod(appleFacts, buildFiscalCalendar(appleFacts));
const jpmFacts = allFacts(jpm);
const jpmValues = latestByPeriod(jpmFacts, buildFiscalCalendar(jpmFacts));

const M = 1_000_000; // values below in $M

describe("F2-4 canonical metrics", () => {
  it("F2-4: computes all twelve canonical metrics when every input is reported (Apple FY2024)", () => {
    const m = computeMetrics(appleValues, "FY2024");
    expect(m.revenue.value).toBe(391035 * M);
    expect(m.gross_profit.value).toBe(180683 * M);
    expect(m.gross_margin.value).toBeCloseTo(180683 / 391035, 10);
    expect(m.operating_income.value).toBe(123216 * M);
    expect(m.operating_margin.value).toBeCloseTo(123216 / 391035, 10);
    expect(m.net_income.value).toBe(93736 * M);
    expect(m.net_margin.value).toBeCloseTo(93736 / 391035, 10);
    expect(m.operating_cash_flow.value).toBe(118254 * M);
    expect(m.free_cash_flow.value).toBe((118254 - 9447) * M);
    expect(m.cash.value).toBe(29943 * M);
    expect(m.total_debt.value).toBe((96662 + 9967) * M); // term debt + commercial paper
    expect(m.debt_to_equity.value).toBeCloseTo((96662 + 9967) / 56950, 10);
    for (const r of Object.values(m)) expect(r.reason).toBeUndefined();
  });

  it("F2-4: derived metrics record their formula and inputs for drill-down", () => {
    const m = computeMetrics(appleValues, "FY2024");
    expect(m.gross_margin.formula).toBe("gross_profit / revenue");
    expect(m.gross_margin.inputs.gross_profit?.value).toBe(180683 * M);
    expect(m.gross_margin.inputs.revenue?.value).toBe(391035 * M);
    expect(m.free_cash_flow.formula).toBe("operating_cash_flow − capex");
    expect(m.free_cash_flow.inputs.capex?.value).toBe(9447 * M);
    expect(m.revenue.formula).toBeNull();
    expect(m.revenue.inputs.revenue?.value).toBe(391035 * M);
  });

  it("F2-4: total debt falls back to current + noncurrent term debt when LongTermDebt is not reported (Apple FY2018)", () => {
    const m = computeMetrics(appleValues, "FY2018");
    expect(m.total_debt.value).toBe((8784 + 93735 + 11964) * M);
    expect(m.debt_to_equity.value).toBeCloseTo((8784 + 93735 + 11964) / 107147, 10);
  });
});

describe("F2-4 missing inputs", () => {
  it("F2-4: a reported metric with no value is null with reason no_data, never 0 (JPMorgan FY2024)", () => {
    const m = computeMetrics(jpmValues, "FY2024");
    for (const metric of ["gross_profit", "operating_income", "cash"] as const) {
      expect(m[metric]).toMatchObject({ value: null, reason: "no_data" });
    }
    expect(m.revenue.value).toBe(177556 * M);
    expect(m.net_margin.value).toBeCloseTo(58471 / 177556, 10);
  });

  it("F2-4: a derived metric with a missing input is null with missing_input:<name> (JPMorgan FY2024)", () => {
    const m = computeMetrics(jpmValues, "FY2024");
    expect(m.gross_margin).toMatchObject({ value: null, reason: "missing_input:gross_profit" });
    expect(m.operating_margin).toMatchObject({ value: null, reason: "missing_input:operating_income" });
    expect(m.free_cash_flow).toMatchObject({ value: null, reason: "missing_input:capex" });
    expect(m.total_debt).toMatchObject({ value: null, reason: "missing_input:long_term_debt" });
    expect(m.debt_to_equity).toMatchObject({ value: null, reason: "missing_input:total_debt" });
  });

  it("F2-4: commercial paper alone is not total debt (JPMorgan FY2017Q2: commercial paper, no term debt)", () => {
    const m = computeMetrics(jpmValues, "FY2017Q2");
    expect(m.total_debt).toMatchObject({ value: null, reason: "missing_input:long_term_debt" });
  });

  it("F2-4: a quarter without a reported cash flow has no free cash flow (Apple FY2024Q3: 10-Qs report cash flow YTD only)", () => {
    const m = computeMetrics(appleValues, "FY2024Q3");
    expect(m.revenue.value).toBe(85777 * M);
    expect(m.operating_cash_flow).toMatchObject({ value: null, reason: "no_data" });
    expect(m.free_cash_flow).toMatchObject({ value: null, reason: "missing_input:operating_cash_flow" });
  });

  it("F2-4: a period with no data at all is null everywhere, with a reason on every metric", () => {
    const m = computeMetrics(appleValues, "FY2030");
    const metrics = Object.keys(m) as CanonicalMetric[];
    expect(metrics).toHaveLength(12);
    for (const metric of metrics) {
      expect(m[metric].value).toBeNull();
      expect(m[metric].reason).toMatch(/^(no_data|missing_input:[a-z_]+)$/);
    }
    expect(m.revenue.reason).toBe("no_data");
    expect(m.gross_margin.reason).toBe("missing_input:gross_profit");
  });
});

describe("F2-4 fiscal Q4", () => {
  it("F2-4: Q4 uses derived Q4 flows and the year-end balance (Apple FY2024Q4)", () => {
    const m = computeMetrics(appleValues, "FY2024Q4");
    expect(m.revenue.value).toBe((391035 - 296105) * M);
    expect(m.revenue.inputs.revenue).toMatchObject({ derived: true });
    expect(m.gross_margin.value).toBeCloseTo((180683 - 136804) / (391035 - 296105), 10);
    expect(m.free_cash_flow.value).toBe((118254 - 91443 - (9447 - 6539)) * M);
    expect(m.cash.value).toBe(29943 * M);
    expect(m.total_debt.value).toBe((96662 + 9967) * M);
  });

  it("F2-4: a Q4 input that cannot be derived stays missing (JPMorgan FY2024Q4: no 9M revenue)", () => {
    const m = computeMetrics(jpmValues, "FY2024Q4");
    expect(m.net_income.value).toBe((58471 - 44466) * M);
    expect(m.revenue).toMatchObject({ value: null, reason: "no_data" });
    expect(m.net_margin).toMatchObject({ value: null, reason: "missing_input:revenue" });
  });
});
