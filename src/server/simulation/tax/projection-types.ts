// ─────────────────────────────────────────────────────────────────────────────
// Tax Planning Center — Projected Output Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AnnualTaxProjection {
  year: number;
  age: number;

  // Income
  ordinaryIncome: number;
  ltcgIncome: number;
  totalIncome: number;

  // Tax breakdown
  federalOrdinaryTax: number;
  federalLtcgTax: number;
  federalNiit: number;
  totalFederalTax: number;
  stateIncomeTax: number;
  totalTax: number;
  effectiveTotalRate: number;

  // Marginal rates
  marginalOrdinaryRate: number;
  marginalLtcgRate: number;

  // Bracket headroom (distance from current income to next meaningful ceiling)
  ordinaryBracketHeadroom: number;  // headroom to the 25% ordinary bracket
  ltcgZeroBracketHeadroom: number;  // headroom remaining in the 0% LTCG bracket
  ltcg15BracketHeadroom: number;    // headroom remaining before LTCG hits 20%

  // Roth conversion opportunity
  rothConversionCapacity: number;       // max additional ordinary income before 25% bracket
  estimatedRothTaxCost: number;         // estimated tax on converting that capacity

  // Discrete tax events this year
  carryEvents: Array<{
    fundName: string;
    netCarryAmount: number;
    estimatedTax: number;
  }>;
  lpEvents: Array<{
    fundName: string;
    amount: number;
    taxCharacter: "ltcg" | "ordinary" | "return_of_capital";
    estimatedTax: number;
  }>;
  reSaleEvents: Array<{
    propertyName: string;
    gainAmount: number;
    estimatedTax: number;
  }>;
}

export interface TaxPlanningResult {
  projections: AnnualTaxProjection[];
  totalTaxOverWindow: number;
  averageEffectiveTaxRate: number;
  peakTaxYear: number;
  peakTaxAmount: number;
}

export interface CarrySensitivityPoint {
  /** Fraction of expected gross carry realized (1.0 = 100%) */
  realizationPct: number;
  /** Equivalent haircutPct = 1 − realizationPct */
  haircutPct: number;
  fiYear: number | null;
  fiAge: number | null;
  peakTaxYear: number | null;
  peakTaxAmount: number;
  /** Sum of all carry net of haircut at this realization level */
  totalNetCarry: number;
}

export interface CarrySensitivityResult {
  /** Sum of expectedGrossCarry across all carry positions */
  baseCarryGross: number;
  /** 5 sweep points: 0%, 25%, 50%, 75%, 100% realization */
  points: CarrySensitivityPoint[];
}
