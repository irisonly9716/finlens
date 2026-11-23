// F2 input: one us-gaap fact from SEC companyfacts. Plain data; the SEC adapter
// validates the JSON with Zod before it reaches the domain.

export interface XbrlFact {
  /** us-gaap concept name, e.g. "RevenueFromContractWithCustomerExcludingAssessedTax". */
  concept: string;
  /** Duration start (ISO date); null for a balance-sheet (point-in-time) value. */
  start: string | null;
  /** Duration end or instant date (ISO date). */
  end: string;
  val: number;
  /** Accession number of the filing that reported this fact. */
  accn: string;
  /**
   * Fiscal year / period of the *filing*, not of the fact: a FY2025 10-K's FY2023
   * comparative still says fy 2025. Null on some 8-K recasts. See F2-3.
   */
  fy: number | null;
  fp: string | null;
  /** Form type of the filing, e.g. "10-K", "10-Q", "10-K/A", "8-K". */
  form: string;
  /** Filing date (ISO date). */
  filed: string;
  /** SEC frame id, e.g. "CY2024Q1"; present on one fact per concept and period. */
  frame: string | null;
}
