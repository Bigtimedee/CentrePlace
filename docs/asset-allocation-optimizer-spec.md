# Asset Allocation Optimization Engine -- Product Specification

**Version:** 1.0
**Date:** 2026-03-28
**Status:** Draft
**System:** GPRetire / CentrePlace Financial Simulation Platform

---

## 1. Purpose

This specification defines an asset allocation optimizer that determines the optimal equity/bond/alt split across all investment accounts such that **portfolio income alone** (ordinary yield + qualified yield + tax-exempt yield across all accounts) can cover at least the user's annual expenditure budget minus their earned income over a rolling 12-month horizon.

The optimizer complements the existing quarterly simulation engine and withdrawal optimizer by operating *upstream*: it recommends how to **position** the portfolio before withdrawals are needed, rather than optimizing the withdrawal sequence after the fact.

---

## 2. Definitions and Data Model References

### 2.1 Source Tables

| Table | Key Fields Used |
|---|---|
| `investment_accounts` | `currentBalance`, `accountType`, `equityPct`, `bondPct`, `altPct`, `equityReturnRate`, `bondReturnRate`, `altReturnRate`, `ordinaryYieldRate`, `qualifiedYieldRate`, `taxExemptYieldRate`, `annualContribution` |
| `income_profiles` | `annualSalary`, `annualBonus`, `salaryGrowthRate`, `bonusGrowthRate` |
| `expenditures` | `annualAmount`, `growthRate` |
| `one_time_expenditures` | `amount`, `projectedYear`, `projectedQuarter` |
| `account_holdings` | `ticker`, `assetClass`, `securitySubType`, `marketValue`, `currentValue` |
| `realization_policy` | All allocation and yield fields (used as reference for post-realization reinvestment targets) |

### 2.2 Derived Types (from `SimulationInput`)

The optimizer consumes the same `SimInvestmentAccount`, `SimIncome`, `SimRecurringExpenditure`, and `SimOneTimeExpenditure` types that the quarterly engine already assembles via the tRPC `simulation.run` assembler.

---

## 3. Section A: Income Sufficiency Formula

### 3.1 Core Definitions

```
totalAnnualExpenditures = SUM(expenditure[i].annualAmount * (1 + expenditure[i].growthRate)^yearsFromNow)
                        + SUM(oneTimeExpenditure[j].amount)   [for j where projectedYear falls within the 12-month window]

earnedIncome = annualSalary + annualBonus

incomeGap = totalAnnualExpenditures - earnedIncome

requiredPortfolioIncome = max(0, incomeGap)
```

### 3.2 Current Portfolio Income Calculation

Portfolio income is computed per account, then summed across all accounts:

```
For each account a:
  accountIncome(a) = a.currentBalance * (a.ordinaryYieldRate + a.qualifiedYieldRate + a.taxExemptYieldRate)

currentPortfolioIncome = SUM(accountIncome(a)) for all accounts a
```

### 3.3 Tax-Adjusted Portfolio Income

Not all portfolio income is equal after taxes. The optimizer must compute the after-tax income figure that reflects what is actually spendable:

```
For each account a:
  if a.accountType in {roth_ira, roth_401k}:
    afterTaxIncome(a) = accountIncome(a) * 1.0          # Roth distributions are tax-free
  elif a.accountType == "taxable":
    afterTaxIncome(a) = a.currentBalance * (
      a.ordinaryYieldRate * (1 - marginalOrdinaryRate) +
      a.qualifiedYieldRate * (1 - marginalLtcgRate) +
      a.taxExemptYieldRate * 1.0
    )
  elif a.accountType in {traditional_ira, traditional_401k, sep_ira, solo_401k}:
    afterTaxIncome(a) = accountIncome(a) * (1 - marginalOrdinaryRate)
    # All distributions from traditional accounts are taxed as ordinary income

afterTaxPortfolioIncome = SUM(afterTaxIncome(a)) for all accounts a
```

Where `marginalOrdinaryRate` and `marginalLtcgRate` are the user's marginal tax rates derived from the existing tax engine (see `calculateAnnualTax` in `src/server/simulation/tax/index.ts`).

### 3.4 Coverage Ratio

```
coverageRatio = afterTaxPortfolioIncome / requiredPortfolioIncome
```

Decision logic:

| Coverage Ratio | Status | Action |
|---|---|---|
| >= 1.0 | Sufficient | No optimization needed. Display green status. |
| 0.9 to 0.99 | Marginal | Advisory recommendation. Display yellow status. |
| < 0.9 | Insufficient | Optimization recommended. Display red status. |
| requiredPortfolioIncome = 0 | Not applicable | Earned income covers all expenses. No portfolio income required. |

---

## 4. Section B: Optimization Objective

### 4.1 Formal Objective Function

The optimizer solves a constrained optimization problem across N investment accounts, each with three decision variables: equity weight (e), bond weight (b), and alternative weight (t).

**Maximize:**

```
Z = SUM over all accounts a of:
    a.currentBalance * [
      e(a) * Y_equity(a) +
      b(a) * Y_bond(a) +
      t(a) * Y_alt(a)
    ]
```

Where `Y_equity(a)`, `Y_bond(a)`, `Y_alt(a)` are the expected income yields for each asset class within account `a`. These are decomposed as:

| Asset Class | Typical ordinaryYieldRate | Typical qualifiedYieldRate | Typical taxExemptYieldRate | Total Yield |
|---|---|---|---|---|
| Equity (broad market) | 0.002 | 0.013 | 0.000 | 0.015 |
| Bond (investment grade) | 0.040 | 0.000 | 0.000 | 0.040 |
| Bond (municipal) | 0.000 | 0.000 | 0.035 | 0.035 |
| Alternatives (REITs, MLP, etc.) | 0.035 | 0.005 | 0.000 | 0.040 |

### 4.2 Constraints

**C1: Weight sum constraint (per account)**
```
e(a) + b(a) + t(a) = 1.0   for all accounts a
```

**C2: Portfolio risk constraint (global)**

The total portfolio standard deviation must not exceed the user's risk tolerance `sigma_max`:

```
sigma_portfolio = sqrt( w' * COV * w )
```

Where:
- `w` is the vector of dollar-weighted asset class exposures across all accounts
- `COV` is the 3x3 covariance matrix of equity, bond, and alternative returns

Default covariance matrix (annualized, based on historical data 1990 to 2024):

```
          Equity    Bond      Alt
Equity  [ 0.0289    0.0010    0.0120 ]    (sigma = 17.0%)
Bond    [ 0.0010    0.0016    0.0008 ]    (sigma = 4.0%)
Alt     [ 0.0120    0.0008    0.0144 ]    (sigma = 12.0%)
```

Risk tolerance mapping:

| User Risk Profile | sigma_max (annualized) |
|---|---|
| Conservative | 6% |
| Moderate | 10% |
| Aggressive | 14% |
| Very Aggressive | 18% |

**C3: Asset class bounds (per account)**
```
0.20 <= e(a) <= 0.80    (equity)
0.10 <= b(a) <= 0.60    (bond)
0.00 <= t(a) <= 0.30    (alternative)
```

**C4: Account-type-specific constraints** (see Section C for full detail)

These tighten the global bounds based on the tax characteristics of each account type.

**C5: Income sufficiency constraint (global)**
```
Z_after_tax >= requiredPortfolioIncome
```

If this constraint cannot be satisfied within the risk and weight bounds, the optimizer returns the allocation that maximizes `Z_after_tax` and reports the remaining income shortfall.

### 4.3 Solution Method

This is a linearly constrained quadratic programming problem (the objective is linear in weights, and the risk constraint is quadratic). Recommended approach:

1. **Primary method:** Sequential Least Squares Programming (SLSQP) or an interior-point solver, which handles both equality and inequality constraints efficiently.
2. **Fallback for simple cases:** If only a single account exists, the problem reduces to a bounded 2-variable optimization (since t = 1 - e - b) that can be solved analytically or via grid search at 1% increments.
3. **Grid resolution:** For multi-account problems, initialize with the account-type-specific defaults from Section C, then run gradient-based optimization from that starting point.

---

## 5. Section C: Account-Type-Specific Allocation Rules

### 5.1 Taxable Accounts

**Objective:** Maximize after-tax income by favoring qualified dividends and tax-exempt interest.

| Parameter | Recommended Range | Default |
|---|---|---|
| equityPct | 0.30 to 0.70 | 0.50 |
| bondPct | 0.20 to 0.50 | 0.30 |
| altPct | 0.00 to 0.20 | 0.20 |
| ordinaryYieldRate | 0.005 to 0.015 | 0.010 |
| qualifiedYieldRate | 0.010 to 0.020 | 0.015 |
| taxExemptYieldRate | 0.010 to 0.040 | 0.020 |

**Rationale:** Taxable accounts should hold tax-efficient equity (qualified dividends taxed at 15%/20% rather than ordinary rates up to 39.6%) and municipal bonds (tax-exempt yield). Avoid holding assets that generate significant ordinary income (high-yield bonds, REITs) in taxable accounts.

**Yield composition guidance:**
- Equity sleeve: Favor broad-market index ETFs (VTI, VXUS) with ~1.3% qualified dividend yield
- Bond sleeve: Favor municipal bond funds (VTEAX, MUB) with ~3.5% tax-exempt yield
- Alt sleeve: Favor tax-managed real estate exposure or commodities with minimal income distributions

### 5.2 Traditional IRA / 401(k) / SEP-IRA / Solo 401(k)

**Objective:** Maximize total income yield (all income taxed as ordinary on withdrawal regardless of character, so no tax-efficiency consideration within the account).

| Parameter | Recommended Range | Default |
|---|---|---|
| equityPct | 0.20 to 0.60 | 0.40 |
| bondPct | 0.20 to 0.60 | 0.40 |
| altPct | 0.00 to 0.30 | 0.20 |
| ordinaryYieldRate | 0.020 to 0.050 | 0.035 |
| qualifiedYieldRate | 0.000 to 0.010 | 0.005 |
| taxExemptYieldRate | 0.000 | 0.000 |

**Rationale:** Since all distributions are taxed as ordinary income, there is no benefit to holding tax-efficient assets here. This is the optimal location for:
- High-yield corporate bonds (ordinary interest)
- REITs (ordinary dividends)
- Bond funds generating ordinary interest
- Any high-income-generating alternative assets

Never hold municipal bonds in traditional accounts (tax-exempt status is wasted since distributions are ordinary).

### 5.3 Roth IRA / Roth 401(k)

**Objective:** Maximize long-term growth (tax-free compounding), not income yield. Roth accounts are the last in the withdrawal waterfall and benefit most from appreciation.

| Parameter | Recommended Range | Default |
|---|---|---|
| equityPct | 0.60 to 0.80 | 0.75 |
| bondPct | 0.10 to 0.30 | 0.15 |
| altPct | 0.00 to 0.20 | 0.10 |
| ordinaryYieldRate | 0.000 to 0.005 | 0.002 |
| qualifiedYieldRate | 0.005 to 0.015 | 0.010 |
| taxExemptYieldRate | 0.000 | 0.000 |

**Rationale:** Roth accounts provide tax-free distributions in retirement and have no RMDs (for Roth IRA; Roth 401k may require RMDs unless rolled to Roth IRA). The optimizer should resist allocating income-producing assets here because:
1. Income yield in a Roth is wasted potential: the tax-free status is most valuable for high-growth assets
2. The withdrawal optimizer (existing Phase 5 code) places Roth accounts at tier 5 in the withdrawal waterfall, meaning they are drawn last
3. Allocating growth assets here maximizes the tax-free compounding window

The optimizer should apply a **growth penalty** when Roth accounts are tilted toward income: reduce the effective contribution of Roth yield income to Z by a factor of 0.5, incentivizing the solver to place income-generating assets in traditional and taxable accounts instead.

### 5.4 Summary Matrix

| Account Type | Primary Role | Equity Range | Bond Range | Alt Range | Tax-Optimal Holdings |
|---|---|---|---|---|---|
| Taxable | Tax-efficient income | 30-70% | 20-50% | 0-20% | Qualified dividend equities, munis |
| Traditional IRA/401k | Maximum income | 20-60% | 20-60% | 0-30% | High-yield bonds, REITs |
| Roth IRA/401k | Long-term growth | 60-80% | 10-30% | 0-20% | Growth equities, small-cap |
| SEP-IRA / Solo 401k | Maximum income | 20-60% | 20-60% | 0-30% | Same as traditional |

---

## 6. Section D: Rebalancing Signal Design

### 6.1 Trigger Conditions

The optimizer evaluates rebalancing triggers on each dashboard load and optionally via a scheduled background check (weekly or on Plaid balance refresh). A rebalancing recommendation is generated when **any** of the following conditions are true:

**Trigger 1: Coverage Ratio Deterioration**
```
coverageRatio < 0.90
```
The portfolio's after-tax income has fallen below 90% of the required portfolio income. This is the primary trigger.

**Trigger 2: Asset Class Drift**
```
For any account a:
  |e(a)_actual - e(a)_target| > 0.05   OR
  |b(a)_actual - b(a)_target| > 0.05   OR
  |t(a)_actual - t(a)_target| > 0.05
```
Any single asset class within any account has drifted more than 5 percentage points from the optimizer's target allocation.

**Trigger 3: Aggregate Portfolio Drift**
```
sigma_portfolio_actual > sigma_max + 0.02
```
The realized portfolio risk exceeds the user's tolerance band by more than 2 percentage points.

**Trigger 4: Expenditure Change**
```
|totalAnnualExpenditures_new - totalAnnualExpenditures_prior| / totalAnnualExpenditures_prior > 0.10
```
The user has modified their expenditure profile by more than 10% since the last optimization run.

**Trigger 5: Income Change**
```
|earnedIncome_new - earnedIncome_prior| / earnedIncome_prior > 0.15
```
Earned income has changed by more than 15% (job change, bonus adjustment, etc.).

**Trigger 6: Time-Based**
```
daysSinceLastOptimization > 90
```
Quarterly review cycle regardless of other triggers.

### 6.2 Output Format

The rebalancing recommendation produces a structured output per account:

```typescript
interface RebalancingRecommendation {
  triggeredBy: TriggerType[];
  timestamp: string;
  coverageRatio: number;
  requiredPortfolioIncome: number;
  currentPortfolioIncome: number;
  incomeShortfall: number;                    // max(0, required - current)
  portfolioRiskEstimate: number;              // annualized sigma
  accounts: AccountRebalanceTarget[];
}

interface AccountRebalanceTarget {
  accountId: string;
  accountName: string;
  accountType: string;
  currentBalance: number;

  current: { equityPct: number; bondPct: number; altPct: number };
  target:  { equityPct: number; bondPct: number; altPct: number };
  delta:   { equityPct: number; bondPct: number; altPct: number };

  currentYield: { ordinaryYieldRate: number; qualifiedYieldRate: number; taxExemptYieldRate: number };
  targetYield:  { ordinaryYieldRate: number; qualifiedYieldRate: number; taxExemptYieldRate: number };

  currentIncome: number;     // current balance * sum of current yield rates
  targetIncome: number;      // current balance * sum of target yield rates
  incomeImpact: number;      // targetIncome - currentIncome

  actionSummary: string;     // human-readable, e.g. "Shift 15% from equity to bonds"
  urgency: "high" | "medium" | "low";
}
```

### 6.3 Urgency Classification

| Urgency | Condition |
|---|---|
| High | coverageRatio < 0.75 OR sigma_actual > sigma_max + 0.04 |
| Medium | coverageRatio 0.75 to 0.90 OR any account drift > 8% |
| Low | coverageRatio 0.90 to 0.99 OR time-based trigger only |

---

## 7. Section E: 12-Month Income Projection Model

### 7.1 Monthly Cashflow Model

The projection runs month by month for 12 months, tracking cumulative income versus cumulative expenditures. This is a near-term tactical model, distinct from the existing 40-year quarterly simulation.

**State variables (initialized at month 0):**

```
For each account a:
  balance(a, 0) = a.currentBalance

monthlyReturn(a) = (e(a) * a.equityReturnRate + b(a) * a.bondReturnRate + t(a) * a.altReturnRate) / 12
monthlyContribution(a) = a.annualContribution / 12
monthlyYield(a) = balance(a, m) * (a.ordinaryYieldRate + a.qualifiedYieldRate + a.taxExemptYieldRate) / 12

monthlyEarnedIncome = (annualSalary + annualBonus) / 12
monthlyExpenditures = totalAnnualExpenditures / 12
```

**Monthly iteration (m = 1 to 12):**

```
For each account a:
  balance(a, m) = balance(a, m-1) * (1 + monthlyReturn(a)) + monthlyContribution(a)

totalMonthlyYield(m) = SUM( balance(a, m) * totalYieldRate(a) / 12 ) for all a

totalMonthlyIncome(m) = monthlyEarnedIncome + totalMonthlyYield(m) + otherIncome(m)
  where otherIncome(m) includes:
    - rentalNetIncome / 12 (from real estate properties)
    - carry realizations falling in month m's quarter
    - LP distributions falling in month m's quarter

totalMonthlyExpenditure(m) = monthlyExpenditures + oneTimeExpenditures(m)
  where oneTimeExpenditures(m) are one-time expenses with projectedYear and projectedQuarter matching month m
```

### 7.2 Cumulative Tracking

```
cumulativeIncome(m) = SUM(totalMonthlyIncome(k)) for k = 1 to m
cumulativeExpenditure(m) = SUM(totalMonthlyExpenditure(k)) for k = 1 to m
monthlySurplus(m) = cumulativeIncome(m) - cumulativeExpenditure(m)
```

### 7.3 Checkpoint Evaluation

At each month m, evaluate:

| Metric | Formula | Threshold |
|---|---|---|
| Rolling coverage | cumulativeIncome(m) / cumulativeExpenditure(m) | >= 1.0 |
| Projected year-end surplus | monthlySurplus(12) | > 0 |
| Worst-case month | min(monthlySurplus(m)) for m = 1 to 12 | > 0 |

**Stress adjustments:** The model should also compute a stress scenario using return rates reduced by 2 standard deviations:

```
stressReturn(a) = monthlyReturn(a) - 2 * sigma(assetClass) / sqrt(12)
```

If the stress scenario produces a negative monthlySurplus at any month, flag the projection as **fragile** and recommend increasing the bond allocation (which reduces volatility and increases yield stability).

### 7.4 Output Structure

```typescript
interface MonthlyProjection {
  month: number;                    // 1 to 12
  calendarMonth: string;            // e.g. "2026-04"
  portfolioBalance: number;         // sum of all account balances
  portfolioYieldIncome: number;     // yield income this month
  earnedIncome: number;
  otherIncome: number;              // rental, carry, LP
  totalIncome: number;
  totalExpenditure: number;
  monthlySurplus: number;           // totalIncome - totalExpenditure
  cumulativeSurplus: number;
  coverageRatio: number;            // cumulative income / cumulative expenditure
}

interface TwelveMonthProjection {
  baseCase: MonthlyProjection[];
  stressCase: MonthlyProjection[];
  annualizedPortfolioYield: number;
  projectedYearEndSurplus: number;
  projectedStressYearEndSurplus: number;
  worstCaseMonth: number;           // month index with lowest surplus
  isFragile: boolean;               // stress scenario has negative surplus in any month
}
```

---

## 8. Section F: Missing Data and Enhancement Opportunities

### 8.1 Data Gaps in Current Schema

| Missing Data | Impact on Optimizer | Recommended Schema Enhancement |
|---|---|---|
| **Holding-level dividend yield** | The current `accountHoldings` table has `ticker`, `assetClass`, and `marketValue` but no yield data per holding. The account-level `ordinaryYieldRate` / `qualifiedYieldRate` / `taxExemptYieldRate` are manually entered estimates. | Add `dividendYield` (real), `yieldType` (enum: ordinary, qualified, tax_exempt) to `account_holdings`. Populate via a market data lookup by ticker. |
| **Options income** | Covered call writing and cash-secured put selling generate income not captured by yield rates. | Add `optionsIncome` table: `accountId`, `strategy` (covered_call, cash_secured_put, collar), `annualPremiumIncome`, `underlyingTicker`. |
| **Real estate cash flow granularity** | `annualRentalIncome` and `annualOperatingExpenses` are single numbers. Vacancy rates, capital reserves, and seasonal variation are not modeled. | Add `vacancyRatePct`, `capitalReserveRatePct`, `managementFeePct` to `real_estate_properties`. Net operating income becomes: `annualRentalIncome * (1 - vacancyRate) - annualOperatingExpenses - (annualRentalIncome * managementFeePct)`. |
| **Tax-lot-level cost basis** | The `costBasis` field exists on `account_holdings` but is not connected to the optimizer. Tax-loss harvesting opportunities cannot be identified. | Wire `costBasis` from `account_holdings` into the optimizer to compute unrealized gains/losses per holding and identify harvesting candidates. |
| **Social Security income** | The FI calculator's `permanentIncome` only includes rental/commercial real estate. Social Security is a major income source post-age 62. | Add `socialSecurityEstimate` table: `userId`, `estimatedMonthlyBenefitAge62`, `estimatedMonthlyBenefitAge67`, `estimatedMonthlyBenefitAge70`, `claimingAge`. |
| **Pension / annuity income** | Not modeled. Some high-net-worth individuals have deferred compensation or pension benefits. | Add `pensionIncome` table: `userId`, `annualBenefit`, `startYear`, `costOfLivingAdjustment`, `survivorBenefitPct`. |
| **529 / education savings** | Children's education costs are modeled in `SimChildEducation` but dedicated education savings accounts are not tracked. | Add `educationSavings` table: `userId`, `childId`, `accountType` (529, Coverdell, UTMA), `currentBalance`, `annualContribution`, `returnRate`. |
| **Risk tolerance profile** | No explicit `riskTolerance` field exists in the user profile. The optimizer needs this to set `sigma_max`. | Add `riskTolerance` enum (conservative, moderate, aggressive, very_aggressive) to `user_profiles`. |
| **Correlation data** | The optimizer uses a static covariance matrix. Actual portfolio correlations depend on specific holdings. | Future enhancement: compute realized correlations from Plaid-connected position-level return data. |

### 8.2 Plaid Integration Enhancements

The existing `plaid_connections` table supports both oneshot and persistent sync modes. The optimizer should leverage Plaid data as follows:

**Balance refresh flow:**

1. On each Plaid sync (triggered by dashboard load or scheduled job), update `investment_accounts.currentBalance` with the latest Plaid-reported balance.
2. If the account is linked to `account_holdings` via a recent `account_statement`, refresh `accountHoldings.currentValue` and `accountHoldings.pricePerShare` from Plaid's investment holdings endpoint.
3. After balance refresh, recompute the coverage ratio. If any rebalancing trigger fires (Section D), generate a new recommendation and display it on the dashboard.

**Position-level data flow:**

1. Plaid's `/investments/holdings/get` endpoint returns individual securities with `security_id`, `close_price`, `quantity`, and `cost_basis`.
2. Map each Plaid security to the `account_holdings` table via ticker matching.
3. Use Plaid's `close_price * quantity` as the authoritative `currentValue`.
4. Derive actual asset class weights from Plaid holdings rather than relying on user-entered `equityPct` / `bondPct` / `altPct`. Compute:
   ```
   actual_equityPct = SUM(holding.currentValue where assetClass = 'equity') / account.currentBalance
   actual_bondPct = SUM(holding.currentValue where assetClass = 'bond') / account.currentBalance
   actual_altPct = SUM(holding.currentValue where assetClass in ('alt', 'cash')) / account.currentBalance
   ```
5. Feed the actual vs. target comparison into the drift triggers (Section D, Trigger 2).

**Dividend income enrichment:**

1. For each holding with a known ticker, query a market data provider (e.g., Financial Modeling Prep, Alpha Vantage, or Polygon.io) for the trailing 12-month dividend yield.
2. Classify the dividend as ordinary or qualified based on the security type:
   - REITs, MLPs, bond funds: ordinary
   - Broad equity ETFs, individual stocks held > 60 days: qualified
   - Municipal bond funds: tax-exempt
3. Aggregate holding-level yields to produce a more accurate account-level `ordinaryYieldRate`, `qualifiedYieldRate`, and `taxExemptYieldRate` than manual user entry.

### 8.3 Future Enhancement Roadmap

**Phase 1 (immediate, no schema changes):**
- Implement the coverage ratio calculator using existing account-level yield rates
- Implement the 12-month projection model
- Implement rebalancing triggers and output format

**Phase 2 (requires minor schema additions):**
- Add `riskTolerance` to user profiles
- Add `socialSecurityEstimate` table
- Implement the constrained optimization solver (SLSQP via a WASM-compiled solver or a TypeScript LP library)

**Phase 3 (requires Plaid enhancement):**
- Derive actual asset class weights from Plaid holdings
- Enrich dividend yield data from market data APIs
- Compute holding-level tax-lot analysis for tax-loss harvesting recommendations

**Phase 4 (advanced):**
- Monte Carlo stress testing on the 12-month projection (1,000 paths using historical return distributions)
- Dynamic rebalancing: auto-generate trade recommendations that can be exported to brokerage
- Factor model integration (Fama-French 3-factor or 5-factor) for more sophisticated risk decomposition

---

## 9. Integration Points with Existing Engine

### 9.1 Relationship to Quarterly Simulation Engine

The quarterly engine (`quarterly-engine.ts`) currently computes `blendedReturnRate` per account and `weightedYieldRates` across the portfolio. The optimizer's target allocations feed directly into these:

- When the optimizer produces new `equityPct` / `bondPct` / `altPct` targets for an account, those become the new inputs to `blendedReturnRate = e * equityReturnRate + b * bondReturnRate + t * altReturnRate`
- The quarterly engine's `yields.ordinaryYieldRate`, `yields.qualifiedYieldRate`, `yields.taxExemptYieldRate` are recomputed from the optimizer's recommended yield profiles

### 9.2 Relationship to Withdrawal Optimizer

The withdrawal optimizer (`withdrawal-optimizer.ts`) operates post-FI and sequences draws across account types. The asset allocation optimizer operates pre-FI and during-FI to ensure the portfolio generates sufficient income. Together:

1. **Asset Allocation Optimizer** (this spec): determines *what to hold* in each account to maximize income yield within risk constraints
2. **Withdrawal Optimizer** (existing Phase 5): determines *where to draw from* when spending exceeds income, minimizing tax drag

The two systems should share a unified view of marginal tax rates. The `marginalOrdinaryRate` and `marginalLtcgRate` calculations in the withdrawal optimizer should be extracted into a shared utility so both systems use identical tax assumptions.

### 9.3 Relationship to FI Calculator

The FI calculator (`fi-calculator.ts`) uses an after-tax return rate to compute `requiredCapital`:

```
afterTaxReturnRate =
  ordinaryYieldRate * 0.60 +
  qualifiedYieldRate * 0.762 +
  taxExemptYieldRate +
  appreciationRate * 0.762
```

When the optimizer shifts allocation (e.g., more bonds, fewer equities), the after-tax return rate changes, which changes `requiredCapital`. The optimizer must ensure that increasing income yield does not push `requiredCapital` so high that it delays the FI date. This creates a natural tension:

- **More bonds** = higher income yield = better coverage ratio = later FI (lower total return)
- **More equities** = lower income yield = worse coverage ratio = earlier FI (higher total return)

The optimizer should include an optional constraint:

```
afterTaxReturnRate_optimized >= afterTaxReturnRate_current * 0.85
```

This prevents the optimizer from reducing total portfolio return by more than 15% in pursuit of income, protecting the user's long-term FI trajectory.

---

## 10. Validation and Testing Requirements

### 10.1 Unit Test Scenarios

1. **Single account, no earned income:** Verify that the optimizer maximizes yield within risk bounds for a retiree with one taxable account.
2. **Multi-account asset location:** Given a taxable + traditional IRA + Roth IRA portfolio, verify that high-yield bonds are placed in traditional, munis in taxable, and growth equities in Roth.
3. **Coverage ratio boundary:** Set expenditures such that coverage ratio is exactly 0.90 and verify the rebalancing trigger fires.
4. **Risk constraint binding:** Set sigma_max = 6% (conservative) and verify the optimizer cannot produce an equity-heavy allocation even if it would maximize income.
5. **12-month stress scenario:** Verify that a 2-sigma drawdown applied to a 70/30 equity/bond portfolio correctly flags the projection as fragile.
6. **No-op case:** Earned income exceeds expenditures. Verify requiredPortfolioIncome = 0 and no optimization runs.
7. **Roth growth penalty:** Verify that the optimizer avoids placing high-yield bonds in a Roth account, preferring traditional placement.

### 10.2 Integration Test

Run the optimizer, feed its output allocations into the quarterly simulation engine, and verify:
- The simulated `portfolioYieldIncome` in Q1 matches the optimizer's projected income (within 2% tolerance for quarterly vs. monthly compounding differences)
- The FI date does not move later by more than 2 years compared to the pre-optimization simulation

---

## 11. Appendix: Reference Yield Assumptions

These are default yield assumptions for asset class sleeves when individual holding data is unavailable. They reflect 2024/2025 market conditions and should be reviewed annually.

| Asset Class Sleeve | Representative ETF | ordinaryYieldRate | qualifiedYieldRate | taxExemptYieldRate | Total Return Assumption |
|---|---|---|---|---|---|
| US Large Cap Equity | VTI | 0.002 | 0.013 | 0.000 | 0.080 |
| International Equity | VXUS | 0.003 | 0.025 | 0.000 | 0.070 |
| Investment Grade Bonds | BND | 0.038 | 0.000 | 0.000 | 0.040 |
| Municipal Bonds | MUB | 0.000 | 0.000 | 0.035 | 0.035 |
| High-Yield Bonds | HYG | 0.055 | 0.000 | 0.000 | 0.055 |
| REITs | VNQ | 0.035 | 0.005 | 0.000 | 0.070 |
| Commodities | DJP | 0.000 | 0.000 | 0.000 | 0.040 |
| Private Credit / Alts | N/A | 0.060 | 0.000 | 0.000 | 0.070 |

---

*End of specification.*
