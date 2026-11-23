import { describe, expect, it } from "vitest";
import apple from "./__fixtures__/aapl-companyfacts.json";
import jpm from "./__fixtures__/jpm-companyfacts.json";
import { allFacts, factsOf } from "./__fixtures__/load-facts";
import {
  buildFiscalCalendar,
  fiscalPeriodOf,
  periodKey,
  type FiscalCalendar,
} from "./fiscal-periods";
import type { XbrlFact } from "./xbrl-facts";

// Real data: Apple's fiscal year ends on the last Saturday of September (52/53-week
// years); JPMorgan's on December 31. See __fixtures__/load-facts.ts for provenance.
const appleFacts = allFacts(apple);
const appleCalendar = buildFiscalCalendar(appleFacts);
const appleRevenue = factsOf(apple, "RevenueFromContractWithCustomerExcludingAssessedTax");
const appleCash = factsOf(apple, "CashAndCashEquivalentsAtCarryingValue");

/** The one fact with these dates (and accession, when given); fails loudly if absent. */
function pick(facts: readonly XbrlFact[], start: string | null, end: string, accn?: string): XbrlFact {
  const found = facts.find(
    (f) => f.start === start && f.end === end && (accn === undefined || f.accn === accn),
  );
  if (!found) throw new Error(`fixture has no fact ${start ?? "(instant)"}..${end} ${accn ?? ""}`);
  return found;
}

function keyOf(fact: Pick<XbrlFact, "start" | "end">, calendar: FiscalCalendar = appleCalendar): string | null {
  return fiscalPeriodOf(fact, calendar).period?.key ?? null;
}

/** Hand-built fact for fiscal calendars the fixtures do not cover. */
function fact(over: Partial<XbrlFact> & Pick<XbrlFact, "end">): XbrlFact {
  return {
    concept: "Revenues",
    start: null,
    val: 1,
    accn: "0000000000-00-000000",
    fy: null,
    fp: null,
    form: "10-Q",
    filed: "2026-01-01",
    frame: null,
    ...over,
  };
}

describe("F2-3 fiscal calendar", () => {
  it("F2-3: learns fiscal year-ends from each 10-K's own period (Apple: late September)", () => {
    expect(appleCalendar.yearEnds).toEqual([
      { fy: 2016, end: "2016-09-24" },
      { fy: 2017, end: "2017-09-30" },
      { fy: 2018, end: "2018-09-29" },
      { fy: 2019, end: "2019-09-28" },
      { fy: 2020, end: "2020-09-26" },
      { fy: 2021, end: "2021-09-25" },
      { fy: 2022, end: "2022-09-24" },
      { fy: 2023, end: "2023-09-30" },
      { fy: 2024, end: "2024-09-28" },
      { fy: 2025, end: "2025-09-27" },
      { fy: 2026, end: "2026-09-26" },
    ]);
  });

  it("F2-3: learns the naming convention: a year ending Feb 1, 2025 can be fiscal 2024", () => {
    // Retailer style (e.g. Target): the 10-K for fiscal 2024 ends 2025-02-01 and also
    // carries the fiscal 2023 comparative, which must not be learned as fiscal 2024.
    const calendar = buildFiscalCalendar([
      fact({ start: "2024-02-04", end: "2025-02-01", fy: 2024, fp: "FY", form: "10-K", accn: "k24" }),
      fact({ start: "2023-01-29", end: "2024-02-03", fy: 2024, fp: "FY", form: "10-K", accn: "k24" }),
    ]);
    expect(calendar.yearEnds).toEqual([{ fy: 2024, end: "2025-02-01" }]);
    expect(keyOf({ start: "2024-02-04", end: "2025-02-01" }, calendar)).toBe("FY2024");
    expect(keyOf({ start: "2025-02-02", end: "2025-05-03" }, calendar)).toBe("FY2025Q1");
  });

  it("F2-3: without any 10-K the period is null with reason no_fiscal_calendar", () => {
    const calendar = buildFiscalCalendar([
      fact({ start: "2025-01-01", end: "2025-03-31", fy: 2025, fp: "Q1", form: "10-Q" }),
    ]);
    expect(calendar.yearEnds).toEqual([]);
    expect(fiscalPeriodOf({ start: "2025-01-01", end: "2025-03-31" }, calendar)).toEqual({
      period: null,
      reason: "no_fiscal_calendar",
    });
  });
});

describe("F2-3 labeling facts", () => {
  it("F2-3: period keys read FY2024, FY2025Q1, FY2024-6M, FY2024-9M", () => {
    expect(periodKey(2024, "FY")).toBe("FY2024");
    expect(periodKey(2025, "Q1")).toBe("FY2025Q1");
    expect(periodKey(2025, "Q4")).toBe("FY2025Q4");
    expect(periodKey(2024, "6M")).toBe("FY2024-6M");
    expect(periodKey(2024, "9M")).toBe("FY2024-9M");
  });

  it("F2-3: a comparative fact gets its own fiscal year, not the filing's fy", () => {
    // FY2023 revenue as re-reported in the FY2025 10-K, which tags it fy 2025.
    const comparative = pick(appleRevenue, "2022-09-25", "2023-09-30", "0000320193-25-000079");
    expect(comparative.fy).toBe(2025);
    expect(fiscalPeriodOf(comparative, appleCalendar)).toEqual({
      period: { fy: 2023, fp: "FY", instant: false, key: "FY2023" },
    });
  });

  it("F2-3: quarters are fiscal, not calendar (Apple's Oct–Dec quarter is Q1)", () => {
    // SEC frame CY2023Q4 = Apple's fiscal Q1 2024.
    const q1 = pick(appleRevenue, "2023-10-01", "2023-12-30", "0000320193-25-000008");
    expect(q1.frame).toBe("CY2023Q4");
    expect(keyOf(q1)).toBe("FY2024Q1");
    expect(keyOf(pick(appleRevenue, "2023-12-31", "2024-03-30"))).toBe("FY2024Q2");
    expect(keyOf(pick(appleRevenue, "2024-03-31", "2024-06-29"))).toBe("FY2024Q3");
  });

  it("F2-3: labels 6-month and 9-month year-to-date durations", () => {
    expect(keyOf(pick(appleRevenue, "2023-10-01", "2024-03-30"))).toBe("FY2024-6M");
    expect(fiscalPeriodOf(pick(appleRevenue, "2023-10-01", "2024-06-29"), appleCalendar)).toEqual({
      period: { fy: 2024, fp: "9M", instant: false, key: "FY2024-9M" },
    });
  });

  it("F2-3: 53-week years: the 371-day FY2023 and its 14-week Q1 keep their labels", () => {
    expect(keyOf(pick(appleRevenue, "2022-09-25", "2023-09-30"))).toBe("FY2023");
    expect(keyOf(pick(appleRevenue, "2022-09-25", "2022-12-31"))).toBe("FY2023Q1");
    expect(keyOf(pick(appleRevenue, "2022-09-25", "2023-07-01"))).toBe("FY2023-9M");
  });

  it("F2-3: balance-sheet instants take the fiscal period they close", () => {
    expect(fiscalPeriodOf(pick(appleCash, null, "2024-12-28"), appleCalendar)).toEqual({
      period: { fy: 2025, fp: "Q1", instant: true, key: "FY2025Q1" },
    });
    expect(keyOf(pick(appleCash, null, "2024-06-29"))).toBe("FY2024Q3");
    // At the fiscal year-end the balance belongs to the year.
    expect(fiscalPeriodOf(pick(appleCash, null, "2024-09-28"), appleCalendar)).toEqual({
      period: { fy: 2024, fp: "FY", instant: true, key: "FY2024" },
    });
  });

  it("F2-3: facts with null fy/fp (8-K recast) are labeled from their dates", () => {
    // Before the first learned year-end (2016-09-24): extrapolated backwards.
    const recast = pick(appleCash, null, "2014-09-27", "0001193125-15-023732");
    expect(recast.fy).toBeNull();
    expect(recast.fp).toBeNull();
    expect(keyOf(recast)).toBe("FY2014");
  });

  it("F2-3: periods after the last learned year-end extrapolate the fiscal year", () => {
    // Calendar from filings before 2025 only (last year-end 2024-09-28).
    const early = buildFiscalCalendar(appleFacts.filter((f) => f.filed < "2025-01-01"));
    expect(early.yearEnds.at(-1)).toEqual({ fy: 2024, end: "2024-09-28" });
    expect(keyOf(pick(appleRevenue, "2024-12-29", "2025-03-29"), early)).toBe("FY2025Q2");
    expect(keyOf({ start: "2024-09-29", end: "2025-09-27" }, early)).toBe("FY2025");
  });

  it("F2-3: calendar-year company (JPMorgan): Jan–Mar is Q1 of the same year", () => {
    const calendar = buildFiscalCalendar(allFacts(jpm));
    const netIncome = factsOf(jpm, "NetIncomeLoss");
    expect(keyOf(pick(netIncome, "2025-01-01", "2025-03-31", "0000019617-25-000421"), calendar)).toBe(
      "FY2025Q1",
    );
    expect(keyOf(pick(netIncome, "2025-01-01", "2025-06-30", "0000019617-25-000615"), calendar)).toBe(
      "FY2025-6M",
    );
    expect(keyOf(pick(netIncome, "2024-01-01", "2024-12-31", "0000019617-25-000270"), calendar)).toBe(
      "FY2024",
    );
  });

  it("F2-3: a 53-week year ending in early January keeps its fiscal year", () => {
    // Fiscal 2025 runs 2024-12-29 .. 2026-01-03; its Q4 ends in January 2026.
    const calendar = buildFiscalCalendar([
      fact({ start: "2023-12-31", end: "2024-12-28", fy: 2024, fp: "FY", form: "10-K", accn: "k24" }),
      fact({ start: "2024-12-29", end: "2026-01-03", fy: 2025, fp: "FY", form: "10-K", accn: "k25" }),
    ]);
    expect(keyOf({ start: "2025-09-28", end: "2026-01-03" }, calendar)).toBe("FY2025Q4");
    expect(keyOf({ start: null, end: "2026-01-03" }, calendar)).toBe("FY2025");
    expect(keyOf({ start: "2026-01-04", end: "2026-04-04" }, calendar)).toBe("FY2026Q1");
  });

  it("F2-3: a duration that is not 3, 6, 9 or 12 months is null with reason unrecognized_duration", () => {
    // A two-month stub period, e.g. after an acquisition.
    expect(fiscalPeriodOf({ start: "2024-09-29", end: "2024-11-30" }, appleCalendar)).toEqual({
      period: null,
      reason: "unrecognized_duration",
    });
  });
});
