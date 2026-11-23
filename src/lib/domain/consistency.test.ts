import { describe, expect, it } from "vitest";
import apple from "./__fixtures__/aapl-companyfacts.json";
import jpm from "./__fixtures__/jpm-companyfacts.json";
import { allFacts } from "./__fixtures__/load-facts";
import { checkGrossProfit, dataQualityFlags } from "./consistency";
import { buildFiscalCalendar } from "./fiscal-periods";
import { latestByPeriod, type PeriodValue } from "./restatements";

// Real data: Apple's revenue − cost of revenue = gross profit exactly in every period,
// so inconsistent periods are made by editing one GrossProfit value in a copy.
// Apple FY2024: revenue 391,035M, cost 210,352M, gross profit 180,683M; 0.5% = 1,955.175M.
const appleFacts = allFacts(apple);
const appleValues = latestByPeriod(appleFacts, buildFiscalCalendar(appleFacts));
const jpmFacts = allFacts(jpm);
const jpmValues = latestByPeriod(jpmFacts, buildFiscalCalendar(jpmFacts));

const M = 1_000_000;
const GP_FY2024 = 180683 * M;

/** A copy of Apple's values with GrossProfit for `key` set to `val` (or removed). */
function withGrossProfit(key: string, val: number | null): PeriodValue[] {
  const isTarget = (v: PeriodValue): boolean => v.concept === "GrossProfit" && v.period.key === key;
  if (val === null) return appleValues.filter((v) => !isTarget(v));
  return appleValues.map((v) => (isTarget(v) ? { ...v, fact: { ...v.fact, val } } : v));
}

describe("F2-6 gross profit consistency", () => {
  it("F2-6: a period where revenue − cost of revenue = gross profit is checked and not flagged (Apple FY2024)", () => {
    const check = checkGrossProfit(appleValues, "FY2024");
    expect(check).toMatchObject({ key: "FY2024", checked: true, flagged: false, difference: 0 });
    expect(check.checked && check.limit).toBeCloseTo(1955.175 * M, 0);
  });

  it("F2-6: flags a period whose difference exceeds 0.5% of revenue", () => {
    const check = checkGrossProfit(withGrossProfit("FY2024", GP_FY2024 - 1956 * M), "FY2024");
    expect(check).toMatchObject({ checked: true, flagged: true, difference: 1956 * M });
  });

  it("F2-6: the limit is 0.5% of revenue in either direction (1,955M passes, ±1,956M flags)", () => {
    const flaggedWith = (gp: number): boolean =>
      checkGrossProfit(withGrossProfit("FY2024", gp), "FY2024").flagged;
    expect(flaggedWith(GP_FY2024 - 1955 * M)).toBe(false);
    expect(flaggedWith(GP_FY2024 + 1955 * M)).toBe(false);
    expect(flaggedWith(GP_FY2024 - 1956 * M)).toBe(true);
    expect(flaggedWith(GP_FY2024 + 1956 * M)).toBe(true);
  });

  it("F2-6: the check records the three inputs and their sources", () => {
    const check = checkGrossProfit(appleValues, "FY2024");
    expect(check.checked).toBe(true);
    if (!check.checked) return;
    expect(check.inputs.revenue.value).toBe(391035 * M);
    expect(check.inputs.cost_of_revenue).toMatchObject({ concept: "CostOfGoodsAndServicesSold", value: 210352 * M });
    expect(check.inputs.gross_profit.source.fact.accn).toBe("0000320193-26-000026");
  });

  it("F2-6: not checked when cost of revenue is not reported (Apple FY2017Q4: gross profit only)", () => {
    expect(checkGrossProfit(appleValues, "FY2017Q4")).toEqual({
      key: "FY2017Q4",
      checked: false,
      flagged: false,
      reason: "missing_input:cost_of_revenue",
    });
  });

  it("F2-6: not checked when gross profit is not reported (Apple FY2024 without GrossProfit; JPMorgan FY2024)", () => {
    expect(checkGrossProfit(withGrossProfit("FY2024", null), "FY2024")).toMatchObject({
      checked: false,
      flagged: false,
      reason: "missing_input:gross_profit",
    });
    expect(checkGrossProfit(jpmValues, "FY2024")).toMatchObject({ checked: false, flagged: false });
  });

  it("F2-6: dataQualityFlags lists only the flagged periods", () => {
    expect(dataQualityFlags(appleValues)).toEqual([]);
    expect(dataQualityFlags(jpmValues)).toEqual([]);
    const tampered = withGrossProfit("FY2024", GP_FY2024 - 5000 * M);
    const flags = dataQualityFlags(tampered);
    expect(flags.map((f) => f.key)).toEqual(["FY2024"]);
    expect(flags[0]).toMatchObject({ checked: true, flagged: true, difference: 5000 * M });
  });
});
