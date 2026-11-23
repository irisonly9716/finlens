import { describe, expect, it } from "vitest";
import apple from "./__fixtures__/aapl-companyfacts.json";
import jpm from "./__fixtures__/jpm-companyfacts.json";
import { allFacts } from "./__fixtures__/load-facts";
import { resolveMetric, type ResolvedValue } from "./concept-resolution";
import { buildFiscalCalendar } from "./fiscal-periods";
import { CONCEPT_LISTS, type ReportedMetric } from "./metric-definitions";
import { latestByPeriod } from "./restatements";

// Real data: Apple tagged revenue as SalesRevenueNet through FY2017's filings,
// Revenues in the FY2018 10-K, and RevenueFromContractWithCustomerExcludingAssessedTax
// from FY2019 (ASC 606) on, re-tagging FY2017–FY2018 comparatives with it.
const appleFacts = allFacts(apple);
const appleValues = latestByPeriod(appleFacts, buildFiscalCalendar(appleFacts));
const jpmFacts = allFacts(jpm);
const jpmValues = latestByPeriod(jpmFacts, buildFiscalCalendar(jpmFacts));

function at(resolved: readonly ResolvedValue[], key: string): ResolvedValue | undefined {
  return resolved.find((r) => r.period.key === key);
}

describe("F2-1 concept lists", () => {
  it("F2-1: revenue concepts are ordered Revenues, RevenueFromContractWithCustomerExcludingAssessedTax, …, SalesRevenueNet", () => {
    const revenue = CONCEPT_LISTS.revenue;
    expect(revenue[0]).toBe("Revenues");
    expect(revenue[1]).toBe("RevenueFromContractWithCustomerExcludingAssessedTax");
    expect(revenue).toContain("SalesRevenueNet");
    expect(revenue.indexOf("SalesRevenueNet")).toBeGreaterThan(1);
  });

  it("F2-1: cost of revenue lists CostOfRevenue before CostOfGoodsAndServicesSold", () => {
    const cost = CONCEPT_LISTS.cost_of_revenue;
    expect(cost.indexOf("CostOfRevenue")).toBeGreaterThanOrEqual(0);
    expect(cost.indexOf("CostOfRevenue")).toBeLessThan(cost.indexOf("CostOfGoodsAndServicesSold"));
  });

  it("F2-1: every reported metric has a concept list, and no concept serves two metrics", () => {
    const lists = Object.entries(CONCEPT_LISTS) as [ReportedMetric, readonly string[]][];
    for (const [, concepts] of lists) expect(concepts.length).toBeGreaterThan(0);
    const all = lists.flatMap(([, concepts]) => concepts);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("F2-1 resolving a metric per period", () => {
  it("F2-1: the first concept in the list with a value wins (Apple FY2018: Revenues)", () => {
    // FY2018 is also tagged RevenueFromContract… in later 10-Ks; list order decides.
    const fy2018 = at(resolveMetric("revenue", appleValues), "FY2018");
    expect(fy2018?.concept).toBe("Revenues");
    expect(fy2018?.value).toBe(265595000000);
    expect(fy2018?.source.fact.accn).toBe("0000320193-18-000145");
  });

  it("F2-1: falls back down the list period by period", () => {
    const revenue = resolveMetric("revenue", appleValues);
    // No Revenues fact for FY2018-9M → second concept.
    expect(at(revenue, "FY2018-9M")).toMatchObject({
      concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
      value: 202695000000,
    });
    // Only SalesRevenueNet for Apple's fiscal Q4 2016 → a later concept.
    expect(at(revenue, "FY2016Q4")).toMatchObject({ concept: "SalesRevenueNet", value: 46852000000 });
    expect(at(revenue, "FY2024")?.concept).toBe("RevenueFromContractWithCustomerExcludingAssessedTax");
  });

  it("F2-1: records the metric, concept, period and source fact for drill-down", () => {
    const fy2024 = at(resolveMetric("revenue", appleValues), "FY2024");
    expect(fy2024).toMatchObject({
      metric: "revenue",
      value: 391035000000,
      concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
      viaOverride: false,
      period: { fy: 2024, fp: "FY", key: "FY2024" },
    });
    expect(fy2024?.source.fact.accn).toBe("0000320193-26-000026");
    expect(fy2024?.source.history).toHaveLength(2);
  });

  it("F2-1: cost of revenue falls back to CostOfGoodsAndServicesSold (Apple has no CostOfRevenue)", () => {
    expect(at(resolveMetric("cost_of_revenue", appleValues), "FY2024")).toMatchObject({
      concept: "CostOfGoodsAndServicesSold",
      value: 210352000000,
    });
  });

  it("F2-1: an admin override for the company and metric wins over the list", () => {
    expect(at(resolveMetric("revenue", appleValues), "FY2017")?.concept).toBe("Revenues");
    const fy2017 = at(resolveMetric("revenue", appleValues, { revenue: "SalesRevenueNet" }), "FY2017");
    expect(fy2017).toMatchObject({
      concept: "SalesRevenueNet",
      value: 229234000000,
      viaOverride: true,
    });
    expect(fy2017?.source.fact.accn).toBe("0000320193-17-000070");
  });

  it("F2-1: where the override concept has no value, the list still applies", () => {
    const fy2024 = at(resolveMetric("revenue", appleValues, { revenue: "SalesRevenueNet" }), "FY2024");
    expect(fy2024).toMatchObject({
      concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
      viaOverride: false,
    });
  });

  it("F2-1: an override for another metric does not change this one", () => {
    const fy2017 = at(
      resolveMetric("revenue", appleValues, { cost_of_revenue: "SalesRevenueNet" }),
      "FY2017",
    );
    expect(fy2017).toMatchObject({ concept: "Revenues", viaOverride: false });
  });

  it("F2-1: one value per period, and none when no listed concept is reported (JPMorgan gross profit)", () => {
    const revenue = resolveMetric("revenue", appleValues);
    const keys = revenue.map((r) => r.period.key);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
    expect(resolveMetric("gross_profit", jpmValues)).toEqual([]);
  });
});
