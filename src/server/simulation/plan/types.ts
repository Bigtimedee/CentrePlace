// ─────────────────────────────────────────────────────────────────────────────
// Annual Action Plan — Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActionCategory =
  | "tax_optimization"
  | "carry_timing"
  | "estate_planning"
  | "insurance_review"
  | "lp_distribution"
  | "fi_acceleration"
  | "liquidity_planning";

export type ActionUrgency = "do_this_year" | "plan_now" | "monitor";

export interface ActionItem {
  id: string;
  /** Short imperative headline */
  title: string;
  /** 2–3 sentence explanation of why this matters this year */
  rationale: string;
  /** Concrete next step */
  action: string;
  category: ActionCategory;
  urgency: ActionUrgency;
  /**
   * Dollar size of the opportunity or obligation. Positive = savings/proceeds;
   * for carry prep it's the tax bill to plan for. 0 = qualitative.
   */
  dollarImpact: number;
  /** Label contextualizing the dollar figure */
  dollarImpactLabel: string;
  /** Deep link to the relevant page */
  deepLinkHref: string;
  deepLinkLabel: string;
  supportingFigures?: Array<{ label: string; value: string }>;
}

export interface AnnualActionPlanResult {
  planYear: number;
  currentAge: number;
  items: ActionItem[];
  totalQuantifiedDollarImpact: number;
  doThisYearCount: number;
  topCategory: ActionCategory | null;
  fiStatus: {
    isFI: boolean;
    yearsToFI: number | null;
    gapToFI: number;
    pctFunded: number;
  };
}
