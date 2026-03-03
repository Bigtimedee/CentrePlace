// ─────────────────────────────────────────────────────────────────────────────
// Cash Flow Waterfall / Liquidity Timeline — Types
// ─────────────────────────────────────────────────────────────────────────────

export type CashEventSource =
  | "carry"
  | "lp_distribution"
  | "real_estate_sale"
  | "w2"
  | "rental";

/** A single discrete cash event at a specific quarter */
export interface CashEvent {
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  periodKey: string; // e.g. "2027-Q3"
  source: CashEventSource;
  /** Fund/property/source name */
  label: string;
  grossAmount: number;
  estimatedTax: number;
  netAmount: number;
  taxCharacter?: "ltcg" | "ordinary" | "return_of_capital";
}

/** Aggregated quarterly totals */
export interface QuarterlyLiquidityBucket {
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  periodKey: string;
  qIndex: number; // 0-based quarter offset from startYear

  carryNet: number;
  lpNet: number;
  realEstateSaleNet: number;
  w2Net: number;
  rentalNet: number;
  totalNet: number;
  cumulativeNet: number;

  /** True when any non-W2/rental event exceeds $50K net */
  hasMajorEvent: boolean;

  events: CashEvent[];
}

/** Enriched GP carry fund summary */
export interface CarryFundSummary {
  fundName: string;
  vintageYear: number;
  carryPct: number;
  currentTvpi: number;
  totalCommittedCapital: number;
  expectedGrossCarry: number;
  haircutPct: number;
  netCarry: number;
  realizationYear: number;
  realizationQuarter: "Q1" | "Q2" | "Q3" | "Q4";
  estimatedTax: number;
  netAfterTax: number;
  pipelineSharePct: number;
}

/** LP fund summary with distribution aggregates */
export interface LPFundSummary {
  fundName: string;
  vintageYear: number;
  commitmentAmount: number;
  currentNav: number;
  totalExpectedDistributions: number;
  firstDistributionYear: number | null;
  lastDistributionYear: number | null;
  distributionCount: number;
}

/** Full output */
export interface LiquidityTimelineResult {
  events: CashEvent[];
  quarters: QuarterlyLiquidityBucket[];
  significantQuarters: QuarterlyLiquidityBucket[];
  carryFunds: CarryFundSummary[];
  lpFunds: LPFundSummary[];
  totals: {
    totalGrossCarry: number;
    totalNetCarry: number;
    totalLPDistributions: number;
    totalRealEstateSaleProceeds: number;
    totalW2: number;
    totalRental: number;
    grandTotalNet: number;
  };
  startYear: number;
  endYear: number;
}
