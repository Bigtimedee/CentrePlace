// ─────────────────────────────────────────────────────────────────────────────
// 12-Month Asset Allocation Optimizer — Design Specification
// ─────────────────────────────────────────────────────────────────────────────
//
// PURPOSE
// -------
// Given a user's complete financial picture (investment accounts with holdings,
// income streams, spending obligations, and tax profile), determine the optimal
// equity/bond/alt allocation across all accounts that maximizes after-tax
// portfolio income (dividends + interest) over the next 12 months while
// respecting risk constraints, contribution limits, and account-type-specific
// tax rules.
//
// This complements the existing systems:
//   - allocation-engine.ts: static glide-path recommendation (age/FI-based)
//   - withdrawal-optimizer.ts: tax-efficient withdrawal sequencing post-FI
//   - quarterly-engine.ts: 40-year forward simulation
//
// The optimizer answers: "What should my allocation be RIGHT NOW so my
// portfolio generates enough income to supplement my salary and meet my
// total spending needs over the next 12 months?"
//
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. MATHEMATICAL OPTIMIZATION MODEL
// ====================================
//
// Decision Variables
// ------------------
// For each account i in {1, ..., N}:
//   w_i_eq  = fraction of account i allocated to equity   (0 <= w_i_eq <= 1)
//   w_i_bd  = fraction of account i allocated to bonds    (0 <= w_i_bd <= 1)
//   w_i_at  = fraction of account i allocated to alts     (0 <= w_i_at <= 1)
//
// Objective Function
// ------------------
// MAXIMIZE: totalAfterTaxIncome
//
// where:
//   totalAfterTaxIncome = SUM_i [ afterTaxIncome_i(w_i_eq, w_i_bd, w_i_at) ]
//
// For each account i with balance B_i:
//
//   grossIncome_i = B_i * (
//     w_i_eq * yieldRate_equity +
//     w_i_bd * yieldRate_bond +
//     w_i_at * yieldRate_alt
//   )
//
// After-tax income depends on account type:
//
//   TAXABLE accounts:
//     afterTaxIncome_i = B_i * (
//       w_i_eq * qualifiedYield_eq * (1 - ltcgTaxRate) +
//       w_i_eq * ordinaryYield_eq * (1 - ordinaryTaxRate) +
//       w_i_bd * ordinaryYield_bd * (1 - ordinaryTaxRate) +
//       w_i_bd * taxExemptYield_bd * 1.0 +
//       w_i_at * qualifiedYield_at * (1 - ltcgTaxRate) +
//       w_i_at * ordinaryYield_at * (1 - ordinaryTaxRate)
//     )
//
//   TRADITIONAL / SEP / SOLO 401k accounts:
//     afterTaxIncome_i = grossIncome_i * (1 - ordinaryTaxRate)
//     (All distributions from traditional accounts are taxed as ordinary income,
//     but yield compounds tax-deferred; we model the yield as if it were
//     distributed for income-gap purposes)
//
//   ROTH accounts:
//     afterTaxIncome_i = grossIncome_i * 1.0
//     (Qualified distributions are entirely tax-free)
//
// The objective is subject to a RISK PENALTY term (Markowitz-inspired):
//
//   MAXIMIZE: totalAfterTaxIncome - lambda * portfolioVariance
//
//   where:
//     portfolioVariance = w^T * SIGMA * w
//     w = aggregate portfolio weight vector [w_eq, w_bd, w_at]
//     SIGMA = 3x3 covariance matrix of asset class returns
//     lambda = risk aversion parameter (calibrated to user's glide-path profile)
//
// This formulation is a variant of mean-variance optimization (Markowitz, 1952)
// adapted to maximize income yield rather than total return, with tax-awareness
// layered on per account type.
//
//
// Constraints
// -----------
// C1. Allocation sums to 100% per account:
//     w_i_eq + w_i_bd + w_i_at = 1.0   for all i
//
// C2. Non-negativity (no short selling):
//     w_i_eq >= 0, w_i_bd >= 0, w_i_at >= 0   for all i
//
// C3. Income sufficiency (soft constraint with penalty):
//     totalAfterTaxIncome + projectedW2Income >= projectedAnnualSpending
//     (If violated, the optimizer still returns the best allocation but flags
//     an income gap in the output.)
//
// C4. Risk budget (per glide-path profile):
//     portfolioEquityPct <= maxEquityPct[profile]
//     portfolioBondPct   >= minBondPct[profile]
//
//     Profile bounds (from allocation-engine.ts glide path):
//       aggressive:    equity <= 0.90, bond >= 0.10
//       moderate:      equity <= 0.75, bond >= 0.20
//       conservative:  equity <= 0.60, bond >= 0.30
//       fi_achieved:   equity <= 0.50, bond >= 0.35
//
// C5. Concentration limits:
//     w_i_at <= 0.30 for any single account (max 30% alternatives)
//     Aggregate alt across all accounts <= 0.25 of total portfolio
//
// C6. Contribution limits (annual, 2026 IRS limits):
//     Traditional 401k / Roth 401k: $23,500 ($31,000 if age >= 50)
//     Traditional IRA / Roth IRA: $7,000 ($8,000 if age >= 50)
//     SEP IRA: min(25% of compensation, $69,000)
//     Solo 401k: $69,000 ($76,500 if age >= 50)
//     (These constrain the annualContribution field, not the allocation
//     weights directly, but the optimizer validates them.)
//
// C7. Tax-location preference (asset location optimization):
//     Tax-inefficient assets (bonds producing ordinary interest) are
//     preferentially placed in tax-advantaged accounts (traditional, Roth).
//     Tax-efficient assets (equity producing qualified dividends) are
//     preferentially placed in taxable accounts.
//     This is implemented via a bonus term in the objective:
//       + mu * SUM_i [ taxLocationScore_i(w_i_eq, w_i_bd, w_i_at) ]
//
//
// ─────────────────────────────────────────────────────────────────────────────
//
// 2. REQUIRED INPUTS AND DATA MODEL
// ===================================

import type { FilingStatus } from "../simulation/tax/types";

/** Yield decomposition for a single asset class */
export interface AssetClassYieldProfile {
  /** Expected total return (appreciation + yield) over 12 months */
  expectedReturn: number;
  /** Ordinary income yield (bond interest, non-qualified dividends) */
  ordinaryYieldRate: number;
  /** Qualified dividend yield (taxed at LTCG rates) */
  qualifiedYieldRate: number;
  /** Tax-exempt yield (muni bond interest) */
  taxExemptYieldRate: number;
  /** Historical annualized volatility (standard deviation of returns) */
  volatility: number;
}

/** Per-account input to the optimizer */
export interface OptimizerAccount {
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
  /** Current allocation (starting point for the optimizer) */
  currentEquityPct: number;
  currentBondPct: number;
  currentAltPct: number;
  /** Annual contribution already committed for the next 12 months */
  annualContribution: number;
  /** Holdings-level detail (optional; enriches yield estimates) */
  holdings?: OptimizerHolding[];
}

/** Individual security within an account */
export interface OptimizerHolding {
  ticker: string | null;
  securityName: string;
  assetClass: "equity" | "bond" | "alt" | "cash";
  securitySubType:
    | "stock"
    | "etf"
    | "mutual_fund"
    | "money_market"
    | "treasury"
    | "corporate_bond"
    | "muni_bond"
    | null;
  marketValue: number;
  /** Trailing 12-month dividend yield (from price refresh / enrichment) */
  trailingYield?: number;
}

/** User income and spending context */
export interface OptimizerIncomeContext {
  annualSalary: number;
  annualBonus: number;
  salaryGrowthRate: number;
  bonusGrowthRate: number;
  /** Permanent income from rental/commercial real estate (net of expenses) */
  permanentRentalIncome: number;
  /** Expected carry realizations in the next 12 months (after haircut) */
  expectedCarryIncome12Mo: number;
  /** Expected LP distributions in the next 12 months */
  expectedLPIncome12Mo: number;
}

/** User spending context */
export interface OptimizerSpendingContext {
  /** Total annual recurring spending (inflation-adjusted) */
  annualRecurringSpending: number;
  /** One-time expenditures within the next 12 months */
  oneTimeSpendingNext12Mo: number;
  /** Annual mortgage payments */
  annualMortgagePayments: number;
  /** Annual insurance premiums */
  annualInsurancePremiums: number;
}

/** Tax context derived from the user's profile and the tax engine */
export interface OptimizerTaxContext {
  filingStatus: FilingStatus;
  stateCode: string;
  cityCode?: string;
  /** Marginal federal ordinary income tax rate at current income level */
  marginalOrdinaryRate: number;
  /** Marginal federal LTCG rate (includes NIIT if applicable) */
  marginalLtcgRate: number;
  /** Marginal state income tax rate */
  marginalStateRate: number;
  /** User's age (for contribution limits and RMD checks) */
  age: number;
}

/** Complete input to the optimizer */
export interface AllocationOptimizerInput {
  accounts: OptimizerAccount[];
  incomeContext: OptimizerIncomeContext;
  spendingContext: OptimizerSpendingContext;
  taxContext: OptimizerTaxContext;
  /** Glide-path profile (from allocation-engine.ts) */
  riskProfile: "aggressive" | "moderate" | "conservative" | "fi_achieved";
  /** Optional: override the risk aversion parameter (default derived from profile) */
  riskAversionOverride?: number;
  /** Asset class yield assumptions (defaults provided if omitted) */
  yieldAssumptions?: {
    equity: AssetClassYieldProfile;
    bond: AssetClassYieldProfile;
    alt: AssetClassYieldProfile;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//
// 3. ALGORITHM AND COMPUTATION STEPS
// ====================================
//
// The optimizer uses Sequential Least Squares Programming (SLSQP) applied to
// the quadratic mean-variance-income problem. Since the number of decision
// variables is small (3N where N is typically 2-8 accounts), the problem is
// tractable without a dedicated QP solver. We use an iterative gradient
// projection method.
//
// Step 1: ASSEMBLE INPUTS
//   a. Load all accounts via assembleSimInput() or dedicated optimizer assembler
//   b. Compute marginal tax rates by running the tax engine at current income
//   c. Determine glide-path profile via computeAllocationRecommendation()
//   d. Aggregate holdings-level yields into account-level yield estimates
//   e. Build the 12-month income projection from incomeContext
//   f. Build the 12-month spending projection from spendingContext
//
// Step 2: COMPUTE INCOME GAP
//   totalProjectedIncome = annualSalary + annualBonus
//                        + permanentRentalIncome
//                        + expectedCarryIncome12Mo
//                        + expectedLPIncome12Mo
//   totalProjectedSpending = annualRecurringSpending
//                          + oneTimeSpendingNext12Mo
//                          + annualMortgagePayments
//                          + annualInsurancePremiums
//                          + estimatedAnnualTax
//   incomeGap = max(0, totalProjectedSpending - totalProjectedIncome)
//
//   This is the minimum portfolio income the optimizer must target.
//
// Step 3: BUILD YIELD MATRIX
//   Construct a (3 x 3) yield matrix Y where:
//     Y[assetClass][yieldType] = rate
//   Default assumptions (overridable):
//     Equity: expectedReturn=0.08, ordinaryYield=0.005, qualifiedYield=0.015,
//             taxExemptYield=0, volatility=0.16
//     Bond:   expectedReturn=0.04, ordinaryYield=0.030, qualifiedYield=0,
//             taxExemptYield=0.015, volatility=0.05
//     Alt:    expectedReturn=0.07, ordinaryYield=0.010, qualifiedYield=0.005,
//             taxExemptYield=0, volatility=0.12
//
//   If holdings are present, override with actual trailing yields aggregated
//   from the holdings enrichment data.
//
// Step 4: BUILD COVARIANCE MATRIX
//   Historical asset class correlations (long-term averages):
//     corr(equity, bond) = -0.20 (flight-to-quality; Dimson, Marsh & Staunton)
//     corr(equity, alt)  =  0.65 (real estate/commodities correlation with equity)
//     corr(bond, alt)    =  0.15 (low positive correlation)
//
//   SIGMA[i][j] = corr[i][j] * vol[i] * vol[j]
//
// Step 5: COMPUTE TAX-ADJUSTED YIELDS PER ACCOUNT
//   For each account, apply the tax treatment rules:
//
//   taxable:
//     afterTaxYield = qualifiedYield * (1 - ltcgRate)
//                   + ordinaryYield * (1 - ordinaryRate - stateRate)
//                   + taxExemptYield
//
//   traditional/sep/solo401k:
//     afterTaxYield = totalYield * (1 - ordinaryRate - stateRate)
//     (Yield compounds tax-deferred but is taxed as ordinary on distribution.
//     For 12-month income planning, model as if distributed.)
//
//   roth:
//     afterTaxYield = totalYield
//     (Tax-free; highest-yield assets should be housed here.)
//
// Step 6: TAX LOCATION OPTIMIZATION
//   Score each (account, assetClass) pair for tax efficiency:
//
//   taxLocationScore(account, assetClass):
//     if account is Roth:
//       Prefer highest-yielding assets (bonds > alts > equity)
//       Score = totalYield[assetClass] * 10
//     if account is Traditional:
//       Prefer high ordinary yield (bonds) since growth is taxed as ordinary anyway
//       Score = ordinaryYield[assetClass] * 5
//     if account is Taxable:
//       Prefer qualified dividends and tax-exempt income
//       Score = qualifiedYield[assetClass] * 5 + taxExemptYield[assetClass] * 8
//              - ordinaryYield[assetClass] * 3  // penalty for ordinary yield in taxable
//
//   This score is added to the objective with weight mu = 0.001 (small enough
//   to not overwhelm the income objective but large enough to break ties).
//
// Step 7: SOLVE OPTIMIZATION
//   Method: Iterative coordinate descent with projection
//
//   a. Initialize w = current allocation (warm start from user's actual data)
//   b. For each iteration t = 1, ..., MAX_ITER (default 100):
//      i.   For each account i, compute gradient of objective w.r.t. (w_i_eq, w_i_bd, w_i_at)
//      ii.  Take gradient step: w_new = w + alpha * grad
//      iii. Project onto feasible set:
//           - Clip to [0, 1]
//           - Normalize to sum to 1 per account
//           - Enforce risk budget constraints (C4, C5)
//      iv.  Check convergence: ||w_new - w|| < epsilon (default 1e-6)
//   c. Compute final objective value and income projection
//
//   For the typical problem size (3-8 accounts, 9-24 variables), this converges
//   in fewer than 50 iterations (sub-millisecond on modern hardware).
//
// Step 8: GENERATE RECOMMENDATIONS
//   a. Compare optimized allocation to current allocation per account
//   b. Compute dollar amounts to rebalance: deltaEquity_i = B_i * (w_i_eq_new - w_i_eq_current)
//   c. Flag any account where the shift exceeds 5% as requiring rebalance action
//   d. Compute projected 12-month after-tax income under the new allocation
//   e. Compute income gap (if any) remaining after optimization
//   f. Score the overall allocation on a 0-100 "Income Readiness" scale
//
// Step 9: VALIDATE AND RETURN
//   a. Verify all constraints satisfied
//   b. Compute sensitivity: how much does income change per 1% shift in each asset class
//   c. Package results into AllocationOptimizerResult
//
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//
// 4. TYPESCRIPT FUNCTION SIGNATURE AND RETURN SCHEMA
// ===================================================

/** Per-account optimized allocation */
export interface OptimizedAccountAllocation {
  accountId: string;
  accountName: string;
  accountType: OptimizerAccount["accountType"];
  currentBalance: number;

  /** Current allocation (before optimization) */
  current: { equityPct: number; bondPct: number; altPct: number };
  /** Optimized allocation */
  optimized: { equityPct: number; bondPct: number; altPct: number };

  /** Dollar amount to shift per asset class (positive = buy, negative = sell) */
  rebalanceDelta: {
    equity: number;
    bond: number;
    alt: number;
  };
  /** Whether this account needs rebalancing (any shift > 5% threshold) */
  needsRebalance: boolean;

  /** Projected 12-month after-tax income from this account under new allocation */
  projectedAfterTaxIncome: number;
  /** Projected 12-month after-tax income under current allocation (for comparison) */
  currentAfterTaxIncome: number;
  /** Income improvement from rebalancing this account */
  incomeImprovement: number;

  /** Tax location optimization note */
  taxLocationNote: string;
}

/** Aggregate portfolio metrics */
export interface PortfolioMetrics {
  /** Total portfolio balance across all accounts */
  totalBalance: number;
  /** Dollar-weighted aggregate allocation */
  aggregateCurrent: { equityPct: number; bondPct: number; altPct: number };
  aggregateOptimized: { equityPct: number; bondPct: number; altPct: number };

  /** Annual portfolio volatility (standard deviation) under optimized allocation */
  portfolioVolatility: number;
  /** Expected Sharpe ratio (using risk-free rate of 4.5% for 2026) */
  expectedSharpeRatio: number;

  /** Maximum drawdown estimate (parametric, 95th percentile) */
  estimatedMaxDrawdown95: number;
}

/** 12-month income projection */
export interface IncomeProjection {
  /** W-2 income (salary + bonus, growth-adjusted mid-year) */
  w2Income: number;
  /** Net rental income */
  rentalIncome: number;
  /** Carry realizations */
  carryIncome: number;
  /** LP distributions */
  lpIncome: number;
  /** Portfolio yield income under CURRENT allocation (before-tax) */
  currentPortfolioGrossYield: number;
  /** Portfolio yield income under OPTIMIZED allocation (before-tax) */
  optimizedPortfolioGrossYield: number;
  /** Portfolio yield income under OPTIMIZED allocation (after-tax) */
  optimizedPortfolioAfterTaxYield: number;
  /** Total projected income (all sources, after-tax portfolio yield) */
  totalProjectedIncome: number;
  /** Total projected spending (recurring + one-time + mortgage + insurance + estimated tax) */
  totalProjectedSpending: number;
  /** Income gap: spending minus income (0 if income >= spending) */
  incomeGap: number;
  /** Income surplus: income minus spending (0 if spending >= income) */
  incomeSurplus: number;
}

/** Sensitivity analysis: income impact of 1% shift in each asset class */
export interface SensitivityAnalysis {
  /** Additional after-tax income per 1% increase in equity (holding others constant) */
  incomePerPctEquity: number;
  /** Additional after-tax income per 1% increase in bonds */
  incomePerPctBond: number;
  /** Additional after-tax income per 1% increase in alts */
  incomePerPctAlt: number;
}

/** Month-by-month projected income and balance trajectory */
export interface MonthlyProjection {
  month: number; // 1-12
  /** Cumulative portfolio income (after-tax) through this month */
  cumulativeAfterTaxIncome: number;
  /** Cumulative W-2 + other income through this month */
  cumulativeTotalIncome: number;
  /** Cumulative spending through this month */
  cumulativeSpending: number;
  /** Net cash position (cumulative income minus cumulative spending) */
  netCashPosition: number;
  /** Projected portfolio balance at month-end */
  projectedPortfolioBalance: number;
}

/** Complete optimizer output */
export interface AllocationOptimizerResult {
  /** Per-account optimized allocations */
  accounts: OptimizedAccountAllocation[];
  /** Aggregate portfolio metrics */
  portfolio: PortfolioMetrics;
  /** 12-month income projection */
  incomeProjection: IncomeProjection;
  /** Sensitivity analysis */
  sensitivity: SensitivityAnalysis;
  /** Month-by-month trajectory */
  monthlyProjections: MonthlyProjection[];

  /** Income Readiness Score: 0-100 indicating how well the portfolio covers
   *  the 12-month income gap through yield alone.
   *  100 = portfolio yield fully covers the gap with 20%+ margin
   *  80  = portfolio yield covers the gap exactly
   *  0   = portfolio yield covers none of the gap */
  incomeReadinessScore: number;

  /** Risk profile used */
  riskProfile: "aggressive" | "moderate" | "conservative" | "fi_achieved";

  /** Human-readable summary of the optimization result */
  summary: string;

  /** Warnings (contribution limit violations, extreme concentration, etc.) */
  warnings: string[];

  /** Computation metadata */
  meta: {
    iterationsUsed: number;
    converged: boolean;
    objectiveValue: number;
    computeTimeMs: number;
  };
}

/**
 * 12-Month Asset Allocation Optimizer
 *
 * Determines the optimal equity/bond/alt allocation across all accounts to
 * maximize after-tax portfolio income over the next 12 months, subject to
 * risk constraints and tax-location preferences.
 *
 * Uses mean-variance-income optimization (Markowitz-derived) with tax-aware
 * asset location, solved via iterative coordinate descent with projection.
 *
 * Computation is pure and deterministic (no randomness, no external calls).
 * Typical runtime: < 5ms for 8 accounts.
 *
 * @param input - Complete optimizer input (accounts, income, spending, tax context)
 * @returns Optimized allocation per account with income projections and metrics
 */
export function optimizeAllocation(
  input: AllocationOptimizerInput,
): AllocationOptimizerResult {
  // Implementation placeholder — see algorithm steps above
  throw new Error("Not yet implemented");
}

// ─────────────────────────────────────────────────────────────────────────────
//
// 5. KEY ASSUMPTIONS AND LIMITATIONS
// ====================================
//
// Assumptions:
//
// A1. YIELD STATIONARITY
//     Asset class yields are assumed constant over the 12-month horizon.
//     In reality, yields fluctuate with interest rates, corporate earnings,
//     and market conditions. The optimizer uses trailing yields as the best
//     available estimator, consistent with the "random walk" hypothesis for
//     short-horizon income forecasting (Malkiel, 1973).
//
// A2. NORMAL DISTRIBUTION OF RETURNS
//     The covariance matrix assumes returns are approximately normally
//     distributed. Tail risk (fat tails, skewness) is not modeled. The
//     estimatedMaxDrawdown95 metric uses parametric VaR, which understates
//     tail losses. For a 12-month horizon this is a reasonable simplification.
//
// A3. STATIC TAX RATES
//     Marginal tax rates are computed at the current income level and held
//     constant. In practice, portfolio income itself shifts the taxpayer into
//     higher brackets. The error is bounded: for a $5M portfolio generating
//     3% yield ($150K), the bracket shift is typically 0-5 percentage points.
//     A second-pass refinement (re-solving after computing income) would
//     eliminate this approximation.
//
// A4. NO TRANSACTION COSTS
//     The optimizer does not model brokerage commissions, bid-ask spreads,
//     or capital gains taxes triggered by rebalancing. For ETF-based portfolios
//     at major brokerages (zero commission), this is negligible. For portfolios
//     with large embedded gains, a "tax-aware rebalancing" extension would
//     constrain sell amounts to tax-loss harvesting opportunities.
//
// A5. CONTRIBUTION TIMING
//     Annual contributions are modeled as a lump sum at the start of the
//     12-month period. Dollar-cost averaging effects are not captured.
//
// A6. CORRELATION STABILITY
//     The asset class correlation matrix uses long-term historical averages.
//     During market stress, correlations typically spike toward 1.0 (contagion
//     effect). The optimizer does not model regime-dependent correlations.
//
// A7. NO LEVERAGE
//     The optimizer assumes no margin borrowing or leverage. All weights are
//     constrained to [0, 1]. Insurance policy loans (PPLI, whole life) are
//     handled separately by the withdrawal optimizer.
//
// A8. ROTH YIELD IS NOT DISTRIBUTED
//     In practice, Roth account yield stays inside the account (no taxable
//     event). For income planning purposes, we model the yield as "available"
//     since the user could take qualified distributions. This overstates
//     liquid income by the Roth yield amount if the user is under 59.5.
//
//
// Limitations:
//
// L1. Does not optimize individual security selection (ETF/stock picking).
//     Only optimizes the three-asset-class allocation weights per account.
//     Pair with etf-suggestions.ts for security-level recommendations.
//
// L2. Does not account for RMD obligations (age 73+). If the user is
//     RMD-eligible, traditional account yield is partially forced into
//     ordinary income regardless of allocation. A future version should
//     integrate with the withdrawal-optimizer to model RMD-forced income.
//
// L3. Single-period optimization only. Does not perform multi-period
//     stochastic programming (e.g., dynamic allocation that adapts month
//     by month based on realized returns). This would require Monte Carlo
//     simulation within the optimizer, increasing compute by 100x+.
//
// L4. No tax-loss harvesting integration. The optimizer does not identify
//     embedded losses in current holdings that could offset gains from
//     rebalancing. This is a natural extension for v2.
//
// L5. Assumes the user's spending and income projections are accurate.
//     Garbage in, garbage out. The optimizer cannot validate the user's
//     self-reported salary, bonus, or spending figures.
//
// ─────────────────────────────────────────────────────────────────────────────
//
// 6. IMPLEMENTATION PRIORITY RANKING
// ====================================
//
// Priority 1 (MVP — immediate value):
//   a. Core optimizer function with income maximization objective
//   b. Tax-adjusted yield computation per account type
//   c. Income gap analysis (projected income vs. projected spending)
//   d. Per-account allocation recommendations with dollar deltas
//   e. Income Readiness Score (0-100)
//   f. Integration with existing assembler.ts for data loading
//   g. Unit tests covering all account types and edge cases
//
// Priority 2 (Enhanced — significant improvement):
//   a. Tax location optimization (bond placement in tax-advantaged accounts)
//   b. Holdings-level yield enrichment (use actual trailing yields from holdings)
//   c. Covariance-based risk penalty (full mean-variance objective)
//   d. Monthly income trajectory projections
//   e. Sensitivity analysis
//   f. tRPC router endpoint: `portfolio.optimizeAllocation`
//   g. Integration test with full assembler pipeline
//
// Priority 3 (Advanced — competitive differentiation):
//   a. Tax-aware rebalancing (limit sells that trigger capital gains)
//   b. RMD integration for age 73+ users
//   c. Multi-period stochastic extension (3-month rolling re-optimization)
//   d. Tax-loss harvesting identification during rebalance
//   e. Custom yield assumptions per account (user override)
//   f. Monte Carlo confidence intervals on income projections
//   g. Dashboard visualization component (12-month income waterfall chart)
//
// Estimated implementation effort:
//   Priority 1: 3-4 days (pure computation, no UI)
//   Priority 2: 2-3 days (enrichment + API layer)
//   Priority 3: 4-5 days (advanced analytics + visualization)
//
// ─────────────────────────────────────────────────────────────────────────────
//
// REFERENCES
// ----------
// - Markowitz, H. (1952). "Portfolio Selection." Journal of Finance.
// - Malkiel, B. (1973). "A Random Walk Down Wall Street."
// - Dimson, E., Marsh, P., Staunton, M. (2002). "Triumph of the Optimists."
// - Dammon, R., Spatt, C., Zhang, H. (2004). "Optimal Asset Location and
//   Allocation with Taxable and Tax-Deferred Investing." Journal of Finance.
// - Shoven, J., Sialm, C. (2003). "Asset Location in Tax-Deferred and
//   Conventional Savings Accounts." Journal of Public Economics.
// ─────────────────────────────────────────────────────────────────────────────
