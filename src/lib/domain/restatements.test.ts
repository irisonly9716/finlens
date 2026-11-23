import { describe, expect, it } from "vitest";
import apple from "./__fixtures__/aapl-companyfacts.json";
import jpm from "./__fixtures__/jpm-companyfacts.json";
import { allFacts, factsOf } from "./__fixtures__/load-facts";
import { buildFiscalCalendar } from "./fiscal-periods";
import { latestByPeriod, type PeriodValue } from "./restatements";
import type { XbrlFact } from "./xbrl-facts";

// Real restatements in the fixtures (see __fixtures__/load-facts.ts for provenance).
const appleCalendar = buildFiscalCalendar(allFacts(apple));
const jpmCalendar = buildFiscalCalendar(allFacts(jpm));

function entry(values: readonly PeriodValue[], key: string): PeriodValue | undefined {
  return values.find((v) => v.period.key === key);
}

function sources(facts: readonly XbrlFact[]): string[] {
  return facts.map((f) => `${f.val}@${f.accn}`);
}

describe("F2-5 restatements", () => {
  it("F2-5: a restated period shows the value from the latest filing", () => {
    // Apple FY2017 operating cash flow: 63,598M in the 2017 10-K, restated to 64,225M.
    const values = latestByPeriod(
      factsOf(apple, "NetCashProvidedByUsedInOperatingActivities"),
      appleCalendar,
    );
    const fy2017 = entry(values, "FY2017");
    expect(fy2017?.fact.val).toBe(64225000000);
    expect(fy2017?.fact.accn).toBe("0000320193-19-000119");
    expect(fy2017?.fact.filed).toBe("2019-10-31");
  });

  it("F2-5: earlier filings stay available as history, newest first", () => {
    const values = latestByPeriod(
      factsOf(apple, "NetCashProvidedByUsedInOperatingActivities"),
      appleCalendar,
    );
    expect(sources(entry(values, "FY2017")?.history ?? [])).toEqual([
      "64225000000@0000320193-18-000145",
      "63598000000@0000320193-17-000070",
    ]);
  });

  it("F2-5: a period restated twice (JPMorgan FY2019 revenue) shows the third value", () => {
    const fy2019 = entry(latestByPeriod(factsOf(jpm, "Revenues"), jpmCalendar), "FY2019");
    expect(fy2019?.fact.val).toBe(115720000000);
    expect(sources(fy2019?.history ?? [])).toEqual([
      "115399000000@0000019617-21-000236",
      "115627000000@0000019617-20-000257",
    ]);
  });

  it("F2-5: comparatives from later filings join their own fiscal period, not the filing's fy", () => {
    // Apple FY2023 revenue appears in the FY2023, FY2024 and FY2025 10-Ks.
    const values = latestByPeriod(
      factsOf(apple, "RevenueFromContractWithCustomerExcludingAssessedTax"),
      appleCalendar,
    );
    const fy2023 = entry(values, "FY2023");
    expect(fy2023?.fact.val).toBe(383285000000);
    expect(fy2023?.fact.accn).toBe("0000320193-25-000079");
    expect(fy2023?.history).toHaveLength(2);
    expect(values.filter((v) => v.period.fp === "FY").map((v) => v.period.key).sort()).toEqual([
      "FY2017",
      "FY2018",
      "FY2019",
      "FY2020",
      "FY2021",
      "FY2022",
      "FY2023",
      "FY2024",
      "FY2025",
      "FY2026",
    ]);
  });

  it("F2-5: a later proxy (DEF 14A) with a rounded figure never wins or enters history", () => {
    // JPMorgan FY2025 net income: 57,048M in the 10-K; 57,000M in a later proxy.
    const fy2025 = entry(latestByPeriod(factsOf(jpm, "NetIncomeLoss"), jpmCalendar), "FY2025");
    expect(fy2025?.fact.val).toBe(57048000000);
    expect(fy2025?.fact.form).toBe("10-K");
    expect(fy2025?.history).toEqual([]);
  });

  it("F2-5: an 8-K recast counts as a filing", () => {
    // Apple's 2015 8-K recast is the only source for the FY2014 year-end cash balance.
    const fy2014 = entry(
      latestByPeriod(factsOf(apple, "CashAndCashEquivalentsAtCarryingValue"), appleCalendar),
      "FY2014",
    );
    expect(fy2014?.fact.val).toBe(13844000000);
    expect(fy2014?.fact.form).toBe("8-K");
  });

  it("F2-5: one entry per concept and period across the whole fixture", () => {
    const values = latestByPeriod(allFacts(apple), appleCalendar);
    const ids = values.map((v) => `${v.concept}|${v.period.key}`);
    expect(values.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    // Same period, different concepts: kept apart.
    const fy2024 = values.filter((v) => v.period.key === "FY2024" && !v.period.instant);
    expect(fy2024.map((v) => v.concept)).toEqual(
      expect.arrayContaining(["GrossProfit", "NetIncomeLoss", "OperatingIncomeLoss"]),
    );
  });

  it("F2-5: facts with no fiscal period (unrecognized duration) are left out", () => {
    const base: XbrlFact = {
      concept: "Revenues",
      start: "2023-10-01",
      end: "2024-09-28",
      val: 100,
      accn: "a1",
      fy: 2024,
      fp: "FY",
      form: "10-K",
      filed: "2024-11-01",
      frame: null,
    };
    const stub: XbrlFact = { ...base, start: "2024-09-29", end: "2024-11-30", val: 7, accn: "a2" };
    const values = latestByPeriod([base, stub], appleCalendar);
    expect(values).toHaveLength(1);
    expect(values[0].period.key).toBe("FY2024");
    expect(values[0].fact.val).toBe(100);
  });
});
