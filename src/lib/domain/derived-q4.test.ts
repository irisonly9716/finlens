import { describe, expect, it } from "vitest";
import apple from "./__fixtures__/aapl-companyfacts.json";
import { allFacts } from "./__fixtures__/load-facts";
import { resolveMetric } from "./concept-resolution";
import { deriveQ4, type DerivedQ4 } from "./derived-q4";
import { buildFiscalCalendar } from "./fiscal-periods";
import { latestByPeriod } from "./restatements";

// Real data: Apple reported its fiscal Q4 directly through FY2020 (quarterly table
// in the 10-K) and stopped from FY2021 on, so FY2021–FY2026 need a derived Q4.
const appleFacts = allFacts(apple);
const appleValues = latestByPeriod(appleFacts, buildFiscalCalendar(appleFacts));
const revenue = resolveMetric("revenue", appleValues);

function at(derived: readonly DerivedQ4[], key: string): DerivedQ4 | undefined {
  return derived.find((d) => d.period.key === key);
}

describe("F2-2 derived Q4", () => {
  it("F2-2: derives Q4 as FY minus 9M YTD (Apple FY2024 revenue: 391,035M − 296,105M)", () => {
    expect(at(deriveQ4(revenue), "FY2024Q4")).toMatchObject({
      metric: "revenue",
      period: { fy: 2024, fp: "Q4", instant: false, key: "FY2024Q4" },
      value: 94930000000,
      derived: true,
    });
  });

  it("F2-2: the derived Q4 records its formula and both inputs for drill-down", () => {
    const q4 = at(deriveQ4(revenue), "FY2024Q4");
    expect(q4?.formula).toBe("FY − 9M YTD");
    expect(q4?.inputs.fy.period.key).toBe("FY2024");
    expect(q4?.inputs.fy.value).toBe(391035000000);
    expect(q4?.inputs.fy.source.fact.accn).toBe("0000320193-26-000026");
    expect(q4?.inputs.ytd9m.period.key).toBe("FY2024-9M");
    expect(q4?.inputs.ytd9m.value).toBe(296105000000);
  });

  it("F2-2: a reported Q4 is kept, not derived (Apple reported Q4 through FY2020)", () => {
    expect(deriveQ4(revenue).map((d) => d.period.key).sort()).toEqual([
      "FY2021Q4",
      "FY2022Q4",
      "FY2023Q4",
      "FY2024Q4",
      "FY2025Q4",
      "FY2026Q4",
    ]);
  });

  it("F2-2: works for any flow metric (Apple FY2024 net income: 93,736M − 79,000M)", () => {
    const netIncome = resolveMetric("net_income", appleValues);
    expect(at(deriveQ4(netIncome), "FY2024Q4")?.value).toBe(14736000000);
  });

  it("F2-2: no Q4 without both the FY and the 9M YTD value", () => {
    const noFy = revenue.filter((r) => r.period.key !== "FY2024");
    const no9m = revenue.filter((r) => r.period.key !== "FY2024-9M");
    expect(at(deriveQ4(noFy), "FY2024Q4")).toBeUndefined();
    expect(at(deriveQ4(no9m), "FY2024Q4")).toBeUndefined();
    expect(at(deriveQ4(no9m), "FY2023Q4")?.value).toBe(89498000000); // others unaffected
  });

  it("F2-2: balance-sheet metrics are not derived (the year-end balance is the Q4 balance)", () => {
    const cash = resolveMetric("cash", appleValues);
    expect(cash.some((c) => c.period.key === "FY2024" && c.period.instant)).toBe(true);
    expect(cash.some((c) => c.period.key === "FY2024Q3" && c.period.instant)).toBe(true);
    expect(deriveQ4(revenue).length).toBeGreaterThan(0); // flows do get one
    expect(deriveQ4(cash)).toEqual([]);
  });
});
