// =============================================================================
// SPECIFICATION: Tax-Optimized Investment Selection Engine
// =============================================================================
//
// Feature: computeTaxOptimizedAllocation
// Target User: MFJ filer, Texas (no state income tax)
// Codebase: CentrePlace financial simulation platform
//
// This file is executable TypeScript. It contains the full specification as
// types, constants, and the function signature with detailed JSDoc. The
// implementation body is stubbed; this is the design contract.
//
// =============================================================================


// ---------------------------------------------------------------------------
// SECTION 1: TAX TREATMENT RULES (2024/2025 IRS, post-TCJA-sunset 2026+)
// ---------------------------------------------------------------------------
//
// The engine must model the following rates per income type.
// All references below are to the Internal Revenue Code (IRC) and IRS
// publications current through Rev. Proc. 2024-40.
//
// NOTE: The existing federal-income.ts uses 2026 post-TCJA-sunset brackets.
// This spec follows that convention. If TCJA is extended, swap the bracket
// tables; the logic is identical.
//
// -----------------------------------------------------------------------
// 1A. ORDINARY INCOME (IRC SS 1(a))
//     Includes: W-2, interest on corporate bonds, STCG, non-qualified
//     dividends, traditional IRA/401k distributions, money market yield.
//
//     2026 MFJ Brackets (post-TCJA sunset):
//       10%     $0        to  $23,850
//       15%     $23,851   to  $96,950
//       25%     $96,951   to  $206,700
//       28%     $206,701  to  $394,600
//       33%     $394,601  to  $450,000
//       35%     $450,001  to  $501,050
//       39.6%   over $501,050
//
//     Standard deduction MFJ 2026: $16,600
//
// -----------------------------------------------------------------------
// 1B. QUALIFIED DIVIDENDS (IRC SS 1(h)(11))
//     Taxed at LTCG rates (0% / 15% / 20%) when holding period met
//     (>60 days in 121-day window around ex-dividend date).
//
//     2026 MFJ LTCG/QD Brackets:
//       0%      taxable income up to $96,700
//       15%     $96,701  to  $600,050
//       20%     over $600,050
//
// -----------------------------------------------------------------------
// 1C. LONG-TERM CAPITAL GAINS (IRC SS 1(h))
//     Applies to assets held > 1 year. Same brackets as 1B above.
//     Stacks on top of ordinary income for bracket determination.
//
// -----------------------------------------------------------------------
// 1D. SHORT-TERM CAPITAL GAINS (IRC SS 1222)
//     Assets held <= 1 year. Taxed as ordinary income (1A rates).
//
// -----------------------------------------------------------------------
// 1E. NET INVESTMENT INCOME TAX (IRC SS 1411)
//     3.8% surtax on the LESSER of:
//       (a) net investment income, or
//       (b) MAGI minus $250,000 (MFJ threshold; NOT inflation-indexed)
//     Applies to dividends, interest, capital gains, rental income, etc.
//     Does NOT apply to tax-exempt muni bond interest.
//
// -----------------------------------------------------------------------
// 1F. MUNICIPAL BOND INTEREST (IRC SS 103)
//     Exempt from federal income tax. Also exempt from NIIT.
//     No Texas state tax applies (TX has no income tax).
//     Subject to AMT if the bonds are "private activity bonds" (PABs).
//     The engine should flag PAB munis for AMT exposure.
//
// -----------------------------------------------------------------------
// 1G. U.S. TREASURY INTEREST (IRC SS 103, 31 USC SS 3124)
//     Taxed as ordinary income at federal level.
//     EXEMPT from state and local income tax by federal law.
//     For Texas MFJ filers, this exemption has zero incremental value
//     (TX has no income tax). Treasury interest is treated identically
//     to corporate bond interest for TX filers.
//
// -----------------------------------------------------------------------
// 1H. ACCOUNT TYPE TAX REGIMES
//
//     TAXABLE:          All income taxed in the year earned.
//     TRADITIONAL IRA/401k/SEP/Solo 401k:
//                       Contributions deductible. All withdrawals taxed
//                       as ordinary income (IRC SS 408(d), SS 402(a)).
//                       RMDs begin at age 73 (SECURE 2.0 Act).
//     ROTH IRA/401k:    Contributions after-tax. Qualified distributions
//                       entirely tax-free (IRC SS 408A(d)(1)).
//                       No RMDs for Roth IRA (Roth 401k RMDs eliminated
//                       by SECURE 2.0 starting 2024).
//


// ---------------------------------------------------------------------------
// SECTION 2: ASSET LOCATION MATRIX
// ---------------------------------------------------------------------------
//
// The core insight: place assets that generate the HIGHEST-taxed income into
// accounts that shelter or eliminate that tax.
//
// Account classification:
//   TAX-DEFERRED:  traditional_ira, traditional_401k, sep_ira, solo_401k
//                  (withdrawals taxed as ordinary income at future rates)
//   TAX-FREE:      roth_ira, roth_401k
//                  (qualified withdrawals completely tax-free)
//   TAXABLE:       taxable brokerage
//                  (income taxed annually; capital gains taxed on realization)
//
// ┌────────────────────────┬────────────┬──────────────┬──────────────────────┐
// | Security / Income Type | Tax-Free   | Tax-Deferred | Taxable              |
// |                        | (Roth)     | (Traditional)| (Brokerage)          |
// ├────────────────────────┼────────────┼──────────────┼──────────────────────┤
// | Corporate Bonds        | BEST       | GOOD         | WORST                |
// | (ordinary interest)    | Shields    | Defers       | Taxed annually at    |
// |                        | highest-   | highest-     | ordinary rates up to |
// |                        | taxed      | taxed        | 39.6% + 3.8% NIIT   |
// |                        | income     | income       |                      |
// ├────────────────────────┼────────────┼──────────────┼──────────────────────┤
// | Money Market           | GOOD       | GOOD         | WORST                |
// | (ordinary interest)    | Same as    | Same as      | Ordinary rates +     |
// |                        | corp bonds | corp bonds   | NIIT                 |
// ├────────────────────────┼────────────┼──────────────┼──────────────────────┤
// | REITs / High-Yield     | BEST       | GOOD         | WORST                |
// | (non-qualified divs)   |            |              |                      |
// ├────────────────────────┼────────────┼──────────────┼──────────────────────┤
// | Treasuries             | NEUTRAL    | NEUTRAL      | OK                   |
// | (ordinary income)      | Wastes     | Defers but   | For TX filers, state |
// |                        | Roth space | converts     | exemption has zero   |
// |                        | on lower-  | favorable    | value. Treat same as |
// |                        | taxed      | rates to     | corporate bonds.     |
// |                        | income     | ordinary     |                      |
// ├────────────────────────┼────────────┼──────────────┼──────────────────────┤
// | Stock / Equity ETFs    | NEUTRAL    | AVOID        | BEST                 |
// | (qualified divs + LTCG)| Growth     | Converts     | QD at 0/15/20% +    |
// |                        | tax-free   | favorable    | LTCG preferential    |
// |                        | is great   | LTCG to      | rates. Step-up basis |
// |                        | but space  | ordinary at  | at death. Tax-loss   |
// |                        | is limited | withdrawal   | harvesting possible. |
// ├────────────────────────┼────────────┼──────────────┼──────────────────────┤
// | Growth Stock (low/no   | GOOD       | AVOID        | BEST                 |
// | dividend)              | Max growth | Converts 0%  | Defer gains indef.   |
// |                        | compounds  | div income   | Step-up at death.    |
// |                        | tax-free   | to ordinary  | 0% LTCG if in lower  |
// |                        |            |              | bracket at sale.     |
// ├────────────────────────┼────────────┼──────────────┼──────────────────────┤
// | Muni Bonds             | NEVER      | NEVER        | ONLY                 |
// | (tax-exempt interest)  | Wastes tax | Converts     | Already tax-exempt.  |
// |                        | shelter on | tax-free     | Only makes sense in  |
// |                        | already    | income to    | taxable account.     |
// |                        | tax-free   | taxable at   |                      |
// |                        | income     | withdrawal   |                      |
// ├────────────────────────┼────────────┼──────────────┼──────────────────────┤
// | Mutual Funds (active)  | GOOD       | GOOD         | POOR                 |
// | (high turnover)        | Shields    | Defers       | Forced cap gains     |
// |                        | forced     | forced       | distributions create |
// |                        | dist'ns    | dist'ns      | annual tax drag.     |
// └────────────────────────┴────────────┴──────────────┴──────────────────────┘
//
// PRIORITY ORDER (what to shelter first):
//   1. Corporate bonds and money market funds  --> Roth first, then traditional
//   2. High-turnover active mutual funds       --> Roth or traditional
//   3. REITs and high-yield instruments        --> Roth first, then traditional
//   4. Treasuries (for non-TX filers)          --> Traditional (TX: same as corp)
//   5. Equity index ETFs and growth stocks     --> Taxable account
//   6. Municipal bonds                         --> Taxable account ONLY
//


// ---------------------------------------------------------------------------
// SECTION 3: TYPESCRIPT TYPES AND FUNCTION SIGNATURE
// ---------------------------------------------------------------------------

import type { FilingStatus } from "./types";

// -- Input types -----------------------------------------------------------

export type AccountCategory = "tax_free" | "tax_deferred" | "taxable";

export type SecurityType =
  | "stock"
  | "etf"
  | "mutual_fund"
  | "money_market"
  | "treasury"
  | "corporate_bond"
  | "muni_bond";

export type IncomeCharacter =
  | "ordinary"           // interest, STCG, non-qualified dividends
  | "qualified_dividend" // QD at LTCG rates
  | "long_term_gain"     // LTCG from appreciation
  | "tax_exempt";        // muni bond interest

/** Tax profile for a specific security or holding. */
export interface SecurityTaxProfile {
  securityType: SecurityType;
  ticker?: string;
  /** Fraction of annual yield that is ordinary income (0 to 1). */
  ordinaryYieldFraction: number;
  /** Fraction of annual yield that is qualified dividends (0 to 1). */
  qualifiedYieldFraction: number;
  /** Fraction of annual yield that is tax-exempt (0 to 1). */
  taxExemptYieldFraction: number;
  /** Expected annual total return (appreciation + yield), e.g. 0.08. */
  expectedTotalReturn: number;
  /** Expected annual yield (dividends + interest), e.g. 0.02. */
  expectedYield: number;
  /** Whether this is a high-turnover fund that distributes cap gains. */
  isHighTurnover: boolean;
  /** Whether this muni bond is a private activity bond (AMT exposure). */
  isPrivateActivityBond?: boolean;
}

export interface TaxOptimizationAccount {
  id: string;
  accountName: string;
  accountType:
    | "taxable"
    | "traditional_ira"
    | "roth_ira"
    | "traditional_401k"
    | "roth_401k"
    | "sep_ira"
    | "solo_401k";
  currentBalance: number;
  /** Current holdings in this account with their tax profiles. */
  holdings: Array<{
    holdingId: string;
    ticker?: string;
    securityName: string;
    marketValue: number;
    taxProfile: SecurityTaxProfile;
  }>;
}

export interface TaxOptimizationInput {
  filingStatus: FilingStatus;
  stateCode: string;                // "TX" for Texas
  grossIncome: number;              // Total household gross income
  taxableOrdinaryIncome: number;    // W-2, business income, etc.
  existingQualifiedDividends: number;
  existingLtcg: number;
  age: number;
  year: number;
  accounts: TaxOptimizationAccount[];
  /** If true, also compute Roth conversion opportunity analysis. */
  includeRothConversionAnalysis?: boolean;
}

// -- Output types ----------------------------------------------------------

/** Urgency of a recommended move. */
export type LocationUrgency = "high" | "medium" | "low";

/** A single recommendation to move a holding to a better account type. */
export interface AssetLocationRecommendation {
  holdingId: string;
  ticker?: string;
  securityName: string;
  currentAccountId: string;
  currentAccountName: string;
  currentAccountCategory: AccountCategory;
  recommendedAccountCategory: AccountCategory;
  /** Specific target account ID if one exists with capacity. Null if no suitable account found. */
  recommendedAccountId: string | null;
  recommendedAccountName: string | null;
  /** Annual tax drag in the current location (dollars). */
  annualTaxDragCurrent: number;
  /** Annual tax drag if relocated (dollars). May be 0 for Roth. */
  annualTaxDragRecommended: number;
  /** Annual tax savings from the move (dollars). */
  annualTaxSavings: number;
  urgency: LocationUrgency;
  rationale: string;
  /** Practical notes: contribution limits, transfer mechanics, wash sale warnings. */
  implementationNotes: string;
}

/** Summary of tax efficiency across all accounts. */
export interface TaxEfficiencyScore {
  /** 0 to 100. 100 = all assets perfectly located. */
  overallScore: number;
  /** Annual tax drag from suboptimal placement (dollars). */
  totalAnnualTaxDrag: number;
  /** Annual savings if all recommendations implemented (dollars). */
  potentialAnnualSavings: number;
  /** Breakdown by account. */
  perAccountScores: Array<{
    accountId: string;
    accountName: string;
    accountCategory: AccountCategory;
    score: number;
    taxDrag: number;
  }>;
}

/** Marginal tax rates at the filer's current income level. */
export interface MarginalRateSummary {
  ordinaryFederal: number;
  ordinaryState: number;      // 0 for TX
  ordinaryEffective: number;  // federal + state
  ltcgFederal: number;
  ltcgState: number;          // 0 for TX
  ltcgEffective: number;
  niitApplies: boolean;
  niitRate: number;            // 0.038 or 0
  /** Combined top marginal rate on ordinary income (incl. NIIT if applicable). */
  worstCaseOrdinary: number;
  /** Combined top marginal rate on LTCG/QD (incl. NIIT if applicable). */
  worstCaseLtcg: number;
  /** Tax rate spread: ordinary minus LTCG. Larger spread = more value from asset location. */
  rateSpread: number;
}

export interface TaxOptimizedAllocationResult {
  /** Ordered list of recommended moves, highest savings first. */
  recommendations: AssetLocationRecommendation[];
  /** Aggregate tax efficiency assessment. */
  efficiencyScore: TaxEfficiencyScore;
  /** Marginal rates at the filer's income level. */
  marginalRates: MarginalRateSummary;
  /** Timestamp of computation. */
  computedAt: string;
}

// -- Function signature ----------------------------------------------------

/**
 * Computes tax-optimized asset location recommendations.
 *
 * Given a filer's income profile, account structure, and current holdings,
 * this function evaluates each holding's tax character and determines whether
 * it is optimally located. It produces a ranked list of recommendations to
 * move holdings between account types to minimize annual tax drag.
 *
 * Core algorithm:
 *   1. Classify each account as tax_free / tax_deferred / taxable.
 *   2. Compute the filer's marginal rates (ordinary, LTCG, NIIT).
 *   3. For each holding, compute annual tax drag in its current location
 *      versus the optimal location using the asset location matrix.
 *   4. Rank relocations by annual tax savings (descending).
 *   5. Respect capacity constraints: Roth and traditional accounts have
 *      limited space; taxable has unlimited capacity.
 *   6. Produce an overall tax efficiency score.
 *
 * Constraints respected:
 *   - Cannot directly transfer between IRA and 401k (different custodians).
 *   - Roth conversion is a taxable event (flagged, not auto-recommended
 *     unless includeRothConversionAnalysis is true).
 *   - Muni bonds are NEVER recommended for tax-advantaged accounts.
 *   - High-yield / corporate bonds are NEVER recommended for taxable
 *     accounts when tax-advantaged space is available.
 *
 * @param input - Filer profile, accounts, and holdings
 * @returns Ranked recommendations with dollar savings estimates
 */
export function computeTaxOptimizedAllocation(
  input: TaxOptimizationInput,
): TaxOptimizedAllocationResult {
  // STUB: implementation follows in Phase 7
  throw new Error("Not yet implemented");
}


// ---------------------------------------------------------------------------
// SECTION 4: INCOME-LEVEL SPECIFIC RECOMMENDATIONS (Texas MFJ)
// ---------------------------------------------------------------------------
//
// All examples assume: MFJ, Texas (state tax = 0%), year 2026, standard
// deduction = $16,600. NIIT threshold = $250,000 MAGI.
//
// -----------------------------------------------------------------------
// 4A. $200K GROSS INCOME (MFJ, TX)
// -----------------------------------------------------------------------
//
// Taxable ordinary income: $200,000 - $16,600 = $183,400
// Marginal ordinary rate: 25% (bracket: $96,951 to $206,700)
// Marginal LTCG rate: 15% (bracket: $96,701 to $600,050)
// NIIT: Does NOT apply (AGI $200K < $250K threshold)
// Rate spread: 25% - 15% = 10%
//
// Recommendations:
//   1. PRIORITY: Place corporate bonds and money market in traditional
//      401k or traditional IRA. At 25% ordinary rate, every $10,000 of
//      bond interest sheltered saves $2,500/year in federal tax.
//
//   2. Hold equity index ETFs (VTI, VOO) in taxable brokerage. Qualified
//      dividends taxed at 15%. LTCG deferred until sale. Step-up basis
//      at death eliminates embedded gains.
//
//   3. Muni bonds offer limited value at 25% marginal rate. A 3.5%
//      tax-exempt muni yield is equivalent to 4.67% pre-tax (3.5% / 0.75).
//      Only use munis in taxable if the tax-equivalent yield exceeds
//      available corporate bond yields.
//
//   4. Roth accounts: Prioritize growth equities (QQQ, VUG) here. Tax-free
//      compounding of the highest-growth assets maximizes the Roth advantage.
//      At this income level the Roth grows for decades tax-free, and the
//      25% ordinary rate makes Roth conversions moderately attractive.
//
//   5. Tax-loss harvesting in taxable accounts has moderate value. Harvest
//      STCG losses to offset ordinary income at 25%.
//
// -----------------------------------------------------------------------
// 4B. $350K GROSS INCOME (MFJ, TX)
// -----------------------------------------------------------------------
//
// Taxable ordinary income: $350,000 - $16,600 = $333,400
// Marginal ordinary rate: 28% (bracket: $206,701 to $394,600)
// Marginal LTCG rate: 15% (bracket: $96,701 to $600,050)
// NIIT: YES. AGI $350K > $250K. NIIT applies on lesser of net investment
//       income or ($350K - $250K) = $100K. Adds 3.8% to investment income.
// Effective ordinary rate on investment income: 28% + 3.8% = 31.8%
// Effective LTCG/QD rate: 15% + 3.8% = 18.8%
// Rate spread: 31.8% - 18.8% = 13.0%
//
// Recommendations:
//   1. CRITICAL: Eliminate ALL corporate bonds and money market from taxable.
//      At 31.8% effective ordinary rate, every $10,000 of bond interest in
//      taxable costs $3,180/year. Moving to Roth saves the full amount.
//      Moving to traditional defers at 28% (recovered at withdrawal).
//
//   2. NIIT makes asset location substantially more valuable. The 3.8%
//      surtax applies to dividends, interest, and capital gains in taxable.
//      Sheltering $100K of bond interest saves $3,800/year in NIIT alone.
//
//   3. Equity ETFs remain in taxable. Even with NIIT, the effective
//      LTCG/QD rate (18.8%) is far below the ordinary rate (31.8%). Plus,
//      unrealized gains are never subject to NIIT.
//
//   4. Roth accounts become premium real estate. Place the highest expected
//      return assets here (growth equities, small-cap). At 28%+ rates,
//      Roth conversion of low-basis traditional IRA assets is worth
//      modeling (pay 28% now to avoid 33%+ in future higher brackets).
//
//   5. Consider tax-managed equity funds (e.g., VTMFX) in taxable to
//      minimize capital gains distributions and manage NIIT exposure.
//
//   6. Muni bonds gain significant appeal. Tax-equivalent yield at 31.8%:
//      a 3.5% muni = 5.13% pre-tax. Compare against corporate bonds net
//      of NIIT. Munis also reduce MAGI, potentially reducing NIIT base.
//
// -----------------------------------------------------------------------
// 4C. $500K GROSS INCOME (MFJ, TX)
// -----------------------------------------------------------------------
//
// Taxable ordinary income: $500,000 - $16,600 = $483,400
// Marginal ordinary rate: 35% (bracket: $450,001 to $501,050)
// Marginal LTCG rate: 15% (stacked income likely stays below $600,050)
// NIIT: YES. AGI $500K. NIIT on lesser of net investment income or
//       ($500K - $250K) = $250K. Virtually all investment income hit.
// Effective ordinary rate on investment income: 35% + 3.8% = 38.8%
// Effective LTCG/QD rate: 15% + 3.8% = 18.8%
//   (could reach 20% + 3.8% = 23.8% if stacked income exceeds $600,050)
// Rate spread: 38.8% - 18.8% = 20.0%
//
// Recommendations:
//   1. HIGHEST PRIORITY: Asset location is extremely valuable. The 20%
//      rate spread means every $10,000 of bond interest in the wrong
//      account costs $2,000 more than it needs to. For a $1M bond
//      portfolio yielding 4%, misplacement costs $8,000/year.
//
//   2. Roth accounts are the single most valuable tax shelter. Every
//      dollar of corporate bond interest shielded by Roth avoids 38.8%
//      combined federal + NIIT. Maximize all Roth contribution space.
//      Mega backdoor Roth (after-tax 401k to Roth) is extremely valuable
//      if the employer plan allows it.
//
//   3. Traditional accounts should hold: corporate bonds, money market,
//      high-yield, REITs, and actively managed funds with high turnover.
//      The deferral value is substantial: $40K of bond interest deferred
//      saves $15,520/year at 38.8%.
//
//   4. Taxable accounts should hold ONLY:
//      a) Equity index ETFs (qualified dividends at 18.8%, LTCG deferred)
//      b) Municipal bonds (tax-exempt, no NIIT)
//      c) Tax-managed equity funds (minimal distributions)
//
//   5. Muni bonds are highly tax-efficient at this level. Tax-equivalent
//      yield at 38.8%: a 3.5% muni = 5.72% pre-tax. This exceeds most
//      investment-grade corporate bond yields. Munis should be the
//      primary fixed income allocation in taxable accounts.
//
//   6. Tax-loss harvesting is extremely valuable. Each $1 of realized STCG
//      loss saves $0.388 (ordinary rate + NIIT). Systematic TLH on equity
//      positions in taxable can generate $5K to $15K/year in savings for
//      large portfolios.
//
//   7. Consider I-bonds (Series I savings bonds) for additional tax
//      deferral on ordinary income. Interest is deferred until redemption
//      and exempt from state tax (moot for TX but relevant if they move).
//
//   8. Charitable giving from taxable: donate appreciated stock directly
//      to charity to avoid LTCG + NIIT. At 23.8% LTCG effective rate,
//      donating $50K of appreciated stock saves $11,900 vs. selling and
//      donating cash.
//

// ---------------------------------------------------------------------------
// SECTION 5: IMPLEMENTATION PRIORITY RANKING
// ---------------------------------------------------------------------------
//
// Phase 7A: Core Tax Drag Calculator (Priority 1, ~3 days)
//   - Implement marginal rate computation integrating existing
//     federal-income.ts and state-income.ts
//   - Build SecurityTaxProfile inference from accountHoldings data
//     (map securitySubType + yield rates to SecurityTaxProfile)
//   - Compute per-holding annual tax drag in current location
//   - Compute per-holding annual tax drag in optimal location
//   - Unit tests: verify tax drag at $200K, $350K, $500K income levels
//
// Phase 7B: Asset Location Matrix Engine (Priority 2, ~2 days)
//   - Encode the asset location matrix as a scoring function
//   - Account category classifier (tax_free / tax_deferred / taxable)
//   - Capacity-aware recommendation engine: respect Roth/traditional
//     contribution limits and existing balances
//   - Produce ranked AssetLocationRecommendation[] output
//   - Unit tests: verify muni bonds never recommended for tax-advantaged,
//     corporate bonds never recommended for taxable when space exists
//
// Phase 7C: Tax Efficiency Scoring (Priority 3, ~1 day)
//   - Compute TaxEfficiencyScore (0 to 100 scale)
//   - Per-account breakdown
//   - Integration with existing allocation-engine.ts to combine asset
//     allocation recommendations with asset location recommendations
//
// Phase 7D: NIIT Optimization Layer (Priority 4, ~1 day)
//   - For filers above $250K MAGI: model NIIT impact on each holding
//   - Compute incremental NIIT drag per dollar of investment income
//   - Factor NIIT into the tax drag differential when recommending moves
//   - Flag munis as NIIT-exempt (additional scoring bonus in taxable)
//
// Phase 7E: Roth Conversion Analysis (Priority 5, ~2 days)
//   - Given current ordinary income and bracket headroom, compute the
//     tax cost of converting traditional IRA assets to Roth
//   - Model the breakeven horizon (years until Roth conversion pays off)
//   - Account for future RMD avoidance value
//   - Integrate with quarterly-engine.ts to project multi-year impact
//
// Phase 7F: Dashboard Integration (Priority 6, ~2 days)
//   - AssetLocationCard component showing recommendations
//   - Tax efficiency gauge (0 to 100 score visualization)
//   - Expandable detail rows per recommendation with rationale
//   - Integration into existing portfolio analysis view
//   - tRPC router: taxOptimization.compute endpoint
//
// Phase 7G: Automated Rebalancing Suggestions (Priority 7, ~2 days)
//   - Combine asset allocation gaps (from allocation-engine.ts) with
//     asset location recommendations to produce unified "what to buy
//     where" guidance
//   - Example: "Buy $20K of BND in your Roth IRA and $30K of VTI in
//     your taxable brokerage"
//   - Respect wash sale rules: flag if selling a holding in one account
//     and buying a substantially identical security in another within
//     30 days
//
// TOTAL ESTIMATED EFFORT: ~13 engineering days
//
// Dependencies:
//   - federal-income.ts (existing): marginal rate functions
//   - state-income.ts (existing): state marginal rate functions
//   - allocation-engine.ts (existing): asset allocation targets
//   - holdings.ts schema (existing): accountHoldings with securitySubType
//   - portfolios.ts schema (existing): investmentAccounts with yield rates
//


// ---------------------------------------------------------------------------
// SECTION 6: HELPER CONSTANTS (for implementation reference)
// ---------------------------------------------------------------------------

/** Classify account types into tax treatment categories. */
export const ACCOUNT_CATEGORY_MAP: Record<string, AccountCategory> = {
  taxable: "taxable",
  traditional_ira: "tax_deferred",
  traditional_401k: "tax_deferred",
  sep_ira: "tax_deferred",
  solo_401k: "tax_deferred",
  roth_ira: "tax_free",
  roth_401k: "tax_free",
};

/**
 * Optimal account category for each security type.
 * Index 0 = best, index 1 = acceptable, index 2 = worst.
 */
export const OPTIMAL_LOCATION: Record<SecurityType, AccountCategory[]> = {
  corporate_bond: ["tax_free", "tax_deferred", "taxable"],
  money_market:   ["tax_free", "tax_deferred", "taxable"],
  treasury:       ["tax_free", "tax_deferred", "taxable"],  // For TX filers; non-TX may differ
  mutual_fund:    ["tax_free", "tax_deferred", "taxable"],  // Assumes high-turnover; low-turnover index = stock
  stock:          ["taxable", "tax_free", "tax_deferred"],
  etf:            ["taxable", "tax_free", "tax_deferred"],
  muni_bond:      ["taxable", "taxable", "taxable"],        // NEVER in tax-advantaged
};

/** NIIT threshold by filing status. Not inflation-indexed. */
export const NIIT_THRESHOLD: Record<FilingStatus, number> = {
  single: 200_000,
  married_filing_jointly: 250_000,
};

/** 2025 contribution limits (for capacity calculations). */
export const CONTRIBUTION_LIMITS_2025 = {
  ira_under_50: 7_000,
  ira_over_50: 8_000,
  _401k_under_50: 23_500,
  _401k_over_50: 31_000,
  sep_ira_max: 69_000,     // 25% of compensation, capped
  solo_401k_max: 69_000,   // employee + employer combined
};
