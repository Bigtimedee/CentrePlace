# Tax-Aware Investment Optimization Specification

**GPRetire Feature Spec**
**Version:** 1.0
**Date:** 2026-03-28
**Scope:** Investment selection optimization layer that leverages the existing tax engine (`src/server/simulation/tax/`) and holdings data model (`src/server/db/schema/holdings.ts`) to surface tax-aware recommendations.

---

## Important Note on Tax Law Vintage

GPRetire's federal tax engine currently models **2026 post-TCJA-sunset rates** (10/15/25/28/33/35/39.6%). The user's question references 2025 TCJA rates (10/12/22/24/32/35/37%). This spec presents **both bracket sets** so the optimization layer works under either regime. The engine's `getBrackets()` function in `federal-income.ts` already selects brackets by year, so switching between regimes requires only updating the bracket tables.

---

## A. Federal Tax Bracket Context for MFJ

### A.1 Ordinary Income Brackets

**2025 TCJA Rates (MFJ)** (per IRS Rev. Proc. 2024-40):

| Rate   | Taxable Income Range          |
|--------|-------------------------------|
| 10%    | $0 to $23,850                 |
| 12%    | $23,851 to $96,950            |
| 22%    | $96,951 to $206,700           |
| 24%    | $206,701 to $394,600          |
| 32%    | $394,601 to $501,050          |
| 35%    | $501,051 to $751,600          |
| 37%    | Over $751,600                 |

Standard deduction (2025 MFJ): **$30,000** (projected per Rev. Proc. 2024-40).

**2026 Post-TCJA-Sunset Rates (MFJ)** (currently implemented in `federal-income.ts`):

| Rate   | Taxable Income Range          |
|--------|-------------------------------|
| 10%    | $0 to $23,850                 |
| 15%    | $23,851 to $96,950            |
| 25%    | $96,951 to $206,700           |
| 28%    | $206,701 to $394,600          |
| 33%    | $394,601 to $450,000          |
| 35%    | $450,001 to $501,050          |
| 39.6%  | Over $501,050                 |

Standard deduction (2026 MFJ): **$16,600** (post-TCJA-sunset, per `federal-income.ts`).

### A.2 Qualified Dividend / LTCG Brackets (MFJ)

These rates are the same under both TCJA and post-sunset law; only the threshold dollar amounts change slightly with inflation.

**2026 thresholds** (per `federal-income.ts`):

| Rate   | Taxable Income Range (stacked on ordinary) |
|--------|--------------------------------------------|
| 0%     | $0 to $96,700                              |
| 15%    | $96,701 to $600,050                        |
| 20%    | Over $600,050                              |

Key mechanic: LTCG/qualified dividends "stack on top of" ordinary taxable income for bracket determination. This is correctly implemented in `calculateFederalTax()` via the `ltcgBase` variable. For a high-income MFJ filer whose ordinary taxable income already exceeds $96,700, every dollar of qualified dividend is taxed at 15% minimum (or 20% if stacked income exceeds $600,050).

### A.3 Net Investment Income Tax (NIIT)

Per IRC Section 1411, a **3.8% surtax** applies to the lesser of:
- Net investment income (interest, dividends, capital gains, rental income, royalties), OR
- The excess of Modified Adjusted Gross Income (MAGI) over **$250,000** (MFJ threshold; not inflation-adjusted).

This is correctly implemented in `federal-income.ts` at lines 62-67 and 178-183. The NIIT threshold has remained $250,000 MFJ since its 2013 enactment and is NOT indexed for inflation.

For a high-income MFJ filer, NIIT is effectively guaranteed on all investment income, making the effective LTCG rate **18.8%** (15% + 3.8%) or **23.8%** (20% + 3.8%) and the effective top ordinary rate on investment income **43.4%** (39.6% + 3.8%) post-sunset.

### A.4 Texas Advantage

Texas imposes **$0 state income tax** on all income types. The state engine (`state-income.ts`) correctly configures TX as `{ type: "none", ltcgTreatment: "exempt" }`.

Implications for this user:
- No state tax drag on any income type (ordinary, qualified, LTCG, interest, muni bond interest).
- Municipal bond interest, which is always federal tax-exempt, provides no additional state tax savings in Texas (unlike a California resident where munis save up to 13.3% state tax).
- Treasury bond interest (exempt from state tax per 31 USC 3124) provides no incremental benefit in Texas since the state rate is already 0%.
- The only taxes this user faces are federal income tax, NIIT, and FICA/Medicare where applicable.

---

## B. Account Location Strategy (Asset Location)

Asset location is the practice of placing investments in the account type that minimizes their tax drag. This section defines optimal placement rules for each account type.

### B.1 Taxable Brokerage Accounts

**Best assets to hold here:**

1. **Broad-market equity index ETFs** (e.g., VTI, VXUS, VOO). ETFs are structurally tax-efficient due to the creation/redemption mechanism that avoids distributing capital gains. Low turnover means minimal taxable events.

2. **Individual stocks held long-term (buy and hold).** Unrealized appreciation is not taxed until sale. At death, heirs receive a stepped-up cost basis (IRC Section 1014), permanently eliminating the embedded gain.

3. **Qualified-dividend-paying equities.** For a high-income MFJ filer, qualified dividends are taxed at 15% + 3.8% NIIT = 18.8%, versus ordinary dividends at 33-39.6% + 3.8% = 36.8-43.4%. Preferring qualified-dividend ETFs in taxable accounts saves 18-24.6 percentage points per dollar of income.

4. **Tax-managed equity funds.** Funds that actively minimize distributions (e.g., Vanguard Tax-Managed series, Dimensional Tax-Managed).

5. **Municipal bonds** (federal tax-exempt interest). See Section C.2 for breakeven analysis specific to this Texas MFJ profile.

**Avoid in taxable accounts:**
- REITs (dividends are ordinary income, not qualified)
- High-yield corporate bonds (interest is ordinary income)
- Actively managed funds with high turnover (frequent short-term gain distributions)
- Commodities funds structured as partnerships (complex K-1, ordinary income)

### B.2 Traditional IRA / Traditional 401(k) / SEP IRA / Solo 401(k)

All income generated inside these accounts is tax-deferred. Withdrawals are taxed as ordinary income (IRC Section 408(d), Section 402(a)). Therefore:

**Best assets to hold here:**

1. **High-yield corporate bonds and bond funds.** Interest that would be taxed at 33-39.6% + 3.8% in a taxable account is sheltered until withdrawal. The deferral benefit is maximized for assets generating the highest ordinary income.

2. **REITs / REIT index funds.** REIT dividends are generally nonqualified (ordinary income). Sheltering them in traditional accounts avoids the 36.8-43.4% drag.

3. **High-turnover actively managed funds.** Frequent capital gains distributions that would be taxable events in a brokerage account are sheltered here.

4. **TIPS / I-Bonds (if held in IRA).** Inflation adjustments on TIPS create phantom ordinary income in taxable accounts. Inside a traditional IRA, this is deferred.

5. **Commodities / managed futures.** These often generate a mix of short-term and long-term gains reported on K-1s. Sheltering inside a tax-deferred account eliminates the annual tax complexity.

**Why not growth equities here?** Long-term gains taxed at 15-20% in a taxable account would instead be converted to ordinary income (33-39.6%) upon traditional IRA withdrawal. Placing growth assets in a traditional IRA can actually increase the lifetime tax bill.

### B.3 Roth IRA / Roth 401(k)

All growth and withdrawals are **permanently tax-free** (IRC Section 408A(d)(1)). This makes Roth accounts the highest-value real estate in a portfolio.

**Best assets to hold here:**

1. **High expected-return equities.** Small-cap value, small-cap growth, emerging markets, and concentrated growth positions. Tax-free compounding on the highest-growth assets maximizes the Roth's value.

2. **Aggressive factor tilts** (momentum, value, size). These generate higher turnover and short-term gains in taxable accounts; in a Roth, the distributions are irrelevant.

3. **Alternatives with high expected alpha** (if available in Roth via brokerage window). Any asset expected to produce outsized returns should be Roth-located.

4. **Cryptocurrencies** (if held via a self-directed Roth IRA). Crypto's high volatility and potential for large gains make Roth the ideal location.

### B.4 Priority Ranking

When the user has limited Roth space, allocate using this priority order:

| Priority | Account         | Asset to Place                              | Rationale                                      |
|----------|-----------------|---------------------------------------------|-------------------------------------------------|
| 1        | Roth            | Highest expected-return equities             | Tax-free compounding on largest growth           |
| 2        | Traditional     | REITs, high-yield bonds, TIPS               | Shelters highest-drag ordinary income            |
| 3        | Traditional     | High-turnover active funds                   | Prevents annual taxable distributions            |
| 4        | Taxable         | Broad-market equity index ETFs               | Low drag due to ETF structure + LTCG rates       |
| 5        | Taxable         | Qualified-dividend equities                  | 18.8% rate vs. 43.4% if sheltered incorrectly   |
| 6        | Taxable         | Muni bonds (if breakeven is favorable)       | Federal tax-exempt income                        |

---

## C. Income Type Optimization for MFJ Texas

### C.1 Qualified Dividends vs. Ordinary Dividends

For a high-income MFJ filer in Texas (marginal ordinary rate 33% post-sunset or 24% under TCJA):

**Per $10,000 of income (post-TCJA-sunset, 2026+ rates):**

| Income Type         | Federal Tax Rate          | NIIT  | Total Rate | Tax on $10,000 | After-Tax |
|---------------------|---------------------------|-------|------------|-----------------|-----------|
| Ordinary dividend   | 33% (marginal, ~$400K AGI)| 3.8%  | 36.8%      | $3,680          | $6,320    |
| Qualified dividend  | 15%                       | 3.8%  | 18.8%      | $1,880          | $8,120    |
| **Savings**         |                           |       | **18.0pp** | **$1,800**      |           |

**Per $10,000 of income (2025 TCJA rates):**

| Income Type         | Federal Tax Rate          | NIIT  | Total Rate | Tax on $10,000 | After-Tax |
|---------------------|---------------------------|-------|------------|-----------------|-----------|
| Ordinary dividend   | 24% (marginal, ~$300K AGI)| 3.8%  | 27.8%      | $2,780          | $7,220    |
| Qualified dividend  | 15%                       | 3.8%  | 18.8%      | $1,880          | $8,120    |
| **Savings**         |                           |       | **9.0pp**  | **$900**        |           |

At the top brackets (39.6% ordinary post-sunset), the advantage widens to **$2,480 per $10,000** (24.6 percentage point gap).

**Implementation note:** The existing `qualifiedYieldRate` field on `investmentAccounts` already separates qualified from ordinary yield. The optimization layer should flag any holding where `ordinaryYieldRate > 0` in a taxable account as a potential relocation candidate to a traditional IRA.

### C.2 Municipal Bond Analysis for Texas MFJ

Municipal bond interest is exempt from federal income tax (IRC Section 103). In a state with income tax (e.g., California at 13.3%), munis provide both federal and state savings. In Texas, munis provide **federal savings only**.

**Muni equivalent yield formula:**

```
Taxable Equivalent Yield = Muni Yield / (1 - Marginal Federal Rate)
```

For a Texas MFJ filer, there is no state tax adjustment. The breakeven depends solely on the marginal federal bracket:

| Marginal Federal Rate | Muni Yield Required to Match 5.0% Taxable | Muni Yield Required to Match 5.5% Taxable |
|-----------------------|--------------------------------------------|--------------------------------------------|
| 25% (post-sunset)     | 3.75%                                      | 4.13%                                      |
| 28%                   | 3.60%                                      | 3.96%                                      |
| 33%                   | 3.35%                                      | 3.69%                                      |
| 35%                   | 3.25%                                      | 3.58%                                      |
| 39.6%                 | 3.02%                                      | 3.32%                                      |

**Including NIIT (3.8%):** For a high-income filer subject to NIIT, the effective marginal rate on taxable bond interest is higher. Adjusted formula:

```
Taxable Equivalent Yield = Muni Yield / (1 - (Marginal Federal Rate + 0.038))
```

| Effective Rate (incl. NIIT) | Muni Yield to Match 5.0% Taxable | Muni Yield to Match 5.5% Taxable |
|-----------------------------|----------------------------------|----------------------------------|
| 28.8% (25% + 3.8%)         | 3.56%                            | 3.92%                            |
| 31.8% (28% + 3.8%)         | 3.41%                            | 3.75%                            |
| 36.8% (33% + 3.8%)         | 3.16%                            | 3.48%                            |
| 38.8% (35% + 3.8%)         | 3.06%                            | 3.37%                            |
| 43.4% (39.6% + 3.8%)       | 2.83%                            | 3.12%                            |

**Key insight for Texas:** A California MFJ filer at 43.4% federal + 13.3% state = 56.7% combined rate needs only a 2.17% muni yield to beat a 5.0% taxable bond. A Texas filer at 43.4% federal needs a 2.83% muni yield for the same comparison. Munis are still attractive for this Texas user at the top brackets, but the breakeven is roughly 30% higher than for a high-tax-state resident.

**Recommendation:** The optimization layer should calculate the muni breakeven dynamically using the user's projected marginal rate from the existing `getMarginalOrdinaryRate()` function plus NIIT if applicable.

### C.3 Treasury Interest

Treasury bond and note interest is exempt from state and local income tax per 31 USC Section 3124. For a Texas resident, this provides **zero incremental benefit** since the state rate is already 0%. Treasuries should be evaluated purely on their pre-tax yield versus comparable corporate bonds, with no tax adjustment for this user.

For a California or New York resident, the state tax exemption on Treasuries adds 10-13% of additional after-tax value, making Treasuries significantly more attractive. The optimization layer should incorporate state-specific Treasury treatment when `stateOfResidence` is not a zero-income-tax state.

---

## D. Tax-Loss Harvesting Signal Design

### D.1 Prerequisites

Tax-loss harvesting requires:
1. **costBasis** on `accountHoldings` (already present as `decimal(18,6)`)
2. **currentValue** on `accountHoldings` (already present as `decimal(18,6)`)
3. The holding must be in a **taxable account** (traditional/Roth accounts are tax-deferred/tax-free; harvesting losses there has no tax benefit)
4. The loss must be **unrealized** (the position is still held)

### D.2 Trigger Conditions

Surface a tax-loss harvesting opportunity when ALL of the following are true:

1. `accountType = "taxable"` (on the linked `investmentAccounts` record)
2. `unrealizedLoss = costBasis - currentValue > 0` (the position is underwater)
3. `unrealizedLoss >= $1,000` (de minimis threshold to avoid noise; configurable)
4. The loss is **material relative to the user's tax situation**:
   - If the user has realized gains in the current year, harvesting offsets those gains dollar-for-dollar
   - If no realized gains exist, up to **$3,000** of net capital losses can offset ordinary income per year (IRC Section 1211(b)), with unlimited carryforward
5. **No wash-sale risk detected** (see D.3)

### D.3 Wash-Sale Rule Constraints (IRC Section 1091)

A harvested loss is disallowed if the taxpayer purchases a "substantially identical" security within 30 days before or after the sale (61-day window total).

The optimization layer must:
- Track the **sale date** of any harvested position
- Block or warn against repurchasing the same ticker (or a substantially identical fund) within 30 days
- Flag "substantially identical" risks: same-index funds from different providers (e.g., selling VTSAX and buying SWTSX, both total US market funds, is a gray area; the IRS has not issued definitive guidance on ETF-to-mutual-fund switches of the same index)

**Safe harbor approach:** When recommending a harvest, suggest a replacement security that tracks a **different but correlated index** (e.g., sell a total US market fund, buy an S&P 500 fund, or sell a specific sector ETF and buy a broad-market ETF). This maintains market exposure while clearly avoiding wash-sale rules.

### D.4 Holding Recommendations Integration

Add a new action type to the existing `holdingRecommendations` table:

**New action value:** `"HARVEST"`

The recommendation record would look like:

- `action`: `"HARVEST"`
- `urgency`: Determined by loss magnitude relative to available gains
  - `"high"`: Unrealized loss > $25,000 AND user has realized gains to offset
  - `"medium"`: Unrealized loss > $5,000 OR $3,000 ordinary income offset available
  - `"low"`: Unrealized loss $1,000-$5,000 with limited offsetting value
- `shortRationale`: "Position is $X below cost basis. Harvesting this loss would save approximately $Y in federal taxes this year."
- `alternativeTicker` / `alternativeSecurityName`: A replacement security that maintains similar market exposure without triggering wash-sale rules
- `targetAllocationNote`: "Sell current position, purchase [replacement] after settlement. Do not repurchase [original ticker] for 31 calendar days."

**Schema change required on `holdingRecommendations`:**

The `action` column is currently `text` (not an enum), so adding `"HARVEST"` requires no migration. The recommendation engine TypeScript type union needs to be extended:

```
action: "INCREASE" | "DECREASE" | "HOLD" | "REPLACE" | "SELL" | "HARVEST"
```

### D.5 Loss Carryforward Tracking

When harvested losses exceed current-year gains + $3,000 ordinary offset, the excess carries forward indefinitely (IRC Section 1212(b)). The system should track cumulative carryforward in a new field on the user profile or a dedicated `taxLossCarryforward` table to accurately project future tax savings.

---

## E. NIIT Exposure Monitoring

### E.1 Detection Logic

The existing simulation engine already computes NIIT per year in `calculateFederalTax()`. The optimization layer should add a **prospective alert** that fires when:

1. Projected MAGI for the current or next calendar year exceeds **$250,000** (MFJ threshold, IRC Section 1411(b))
2. AND projected net investment income > $0

The alert should quantify:
- Total projected NIIT liability for the year
- Marginal NIIT cost of the next $10,000 of investment income
- Comparison: the full 3.8% applies to all investment income above the threshold, so for a high-income user, NIIT is effectively a flat 3.8% surcharge on every dollar of investment income

### E.2 Income-Shifting Strategies

When NIIT exposure is confirmed, recommend the following strategies (ordered by implementation complexity):

**Tier 1: Simple (no new entities required)**

1. **Maximize tax-exempt income.** Shift bond allocation toward municipal bonds. Muni bond interest is excluded from net investment income for NIIT purposes (Treas. Reg. Section 1.1411-1(d)(4)).
2. **Harvest capital losses.** Realized losses reduce net investment income, directly reducing the NIIT base.
3. **Defer capital gains.** Hold appreciated positions longer; defer sales into years with lower projected income.

**Tier 2: Moderate (requires planning)**

4. **Roth conversions in low-income years.** Converting traditional IRA to Roth creates ordinary income (increasing MAGI temporarily) but eliminates future investment income from the traditional account. Net beneficial if the conversion year's marginal rate is lower than future rates.
5. **Installment sales (IRC Section 453).** Spreading a large capital gain over multiple years can keep MAGI below the NIIT threshold in each year (though this user likely exceeds $250K regardless).

**Tier 3: Advanced (requires entity/trust structures)**

6. **Qualified Opportunity Zone (QOZ) investments (IRC Section 1400Z-2).** Investing capital gains in a QOZ fund defers the gain and potentially excludes gain on the QOZ investment itself if held 10+ years. Reduces current-year net investment income.
7. **Charitable Remainder Trust (CRT).** A CRT removes assets from the estate, provides an income stream taxed under the CRT's four-tier system, and the charitable remainder bypasses NIIT entirely. For a high-net-worth user, a CRUT (unitrust) can smooth income and reduce NIIT exposure.
8. **Donor Advised Fund (DAF) contributions of appreciated stock.** Donating appreciated positions avoids realizing the gain (no LTCG, no NIIT) while generating a charitable deduction against ordinary income.

### E.3 Dashboard Integration

Add a NIIT exposure widget to the existing Tax Center (`src/components/tax/tax-center.tsx`) showing:
- Current-year projected NIIT
- NIIT as a percentage of total tax burden
- Actionable recommendations from Tiers 1-2 above

---

## F. Investment Type Tax Efficiency Ratings

For the specific user profile: **MFJ, Texas resident, high income (subject to NIIT, marginal federal bracket 33%+ post-sunset).**

| Security SubType   | Tax Efficiency | Rating | Rationale |
|--------------------|----------------|--------|-----------|
| **ETF** (equity index) | Excellent | **5** | Creation/redemption mechanism avoids capital gains distributions. Dividends are mostly qualified (15%+3.8%=18.8%). Minimal annual tax drag. Best-in-class for taxable accounts. |
| **Stock** (individual) | Excellent | **5** | No capital gains until sale (taxpayer controls timing). Qualified dividends at 18.8%. Stepped-up basis at death (IRC Section 1014) permanently eliminates unrealized gains. |
| **Treasury** (bills/notes/bonds) | Good | **4** | Interest is federally taxable as ordinary income (33-39.6%+3.8%), but the Texas advantage (state-exempt, normally worth 5-13% in high-tax states) is worth $0 here. Still rated 4 because Treasuries are the risk-free benchmark and carry zero credit risk. |
| **Money Market** | Moderate | **3** | Interest is ordinary income (33-39.6%+3.8%=36.8-43.4%). No tax-efficiency features. However, money market funds are used for liquidity, not tax optimization. The tax drag is acceptable given the functional purpose. |
| **Mutual Fund** (equity) | Moderate | **3** | Fund manager's trading generates capital gains distributions taxable to shareholders annually, even if the investor did not sell. Qualified dividends help, but turnover-driven gains reduce efficiency versus ETFs. High-turnover funds can have 1-3% annual tax drag. |
| **Corporate Bond** | Poor | **2** | Interest is ordinary income at the highest marginal rates (36.8-43.4% including NIIT). No preferential rate treatment. Best held in traditional IRA/401k where the interest is tax-deferred. |
| **Muni Bond** | Good (context-dependent) | **4** | Federal tax-exempt interest (IRC Section 103). For this Texas user, munis save 28.8-43.4% federal+NIIT versus taxable bonds. No state tax benefit (TX is already 0%). Munis are NOT exempt from NIIT taxation on the interest itself, BUT muni interest IS excluded from "net investment income" for NIIT purposes per Treas. Reg. 1.1411-1(d)(4), making them particularly valuable for NIIT-exposed filers. Rating is 4 rather than 5 because the lower pre-tax yield means the after-tax advantage depends on the specific yield spread. |

### F.1 Location-Adjusted Ratings

The ratings above assume the holding is in a **taxable account**. Inside a Roth IRA, every security type is effectively a 5/5 (all income is tax-free). Inside a traditional IRA, the efficiency question flips: the highest-taxed income types (corporate bonds, REITs) become the best candidates because deferral saves the most.

---

## G. New Data Fields Required

### G.1 Additions to `accountHoldings` Table

| Field Name              | Type              | Description |
|-------------------------|-------------------|-------------|
| `holdingPeriodStart`    | `timestamp`       | Date the position was acquired. Required for STCG vs. LTCG determination (IRC Section 1222: > 1 year = LTCG). For positions acquired in multiple lots, this represents the earliest lot. |
| `unrealizedGain`        | `decimal(18,6)`   | Computed field: `currentValue - costBasis`. Positive = unrealized gain; negative = unrealized loss (harvest candidate). Can be computed on read from existing `costBasis` and `currentValue` columns. |
| `dividendQualifiedPct`  | `real`            | Percentage of the security's dividend that qualifies for preferential LTCG rates (0.0 to 1.0). Source: fund prospectus or Yahoo Finance `qualifiedDividendPct`. Example: S&P 500 index funds are ~95% qualified; REIT funds are ~0% qualified. |
| `holdingTurnoverRate`   | `real`            | Annual portfolio turnover rate of the fund (0.0 to ~2.0+). Source: fund prospectus or Yahoo Finance. Lower turnover = more tax-efficient. Index funds are typically 3-5%; active funds can exceed 100%. |
| `expenseRatio`          | `real`            | Annual expense ratio as a decimal (0.0003 = 0.03%). Already available in the recommendation engine's `marketData` enrichment but not persisted. Persisting enables tax-cost-plus-expense comparisons. |
| `distributionYield`     | `real`            | Trailing 12-month distribution yield (dividends + capital gains distributions). Distinct from `ordinaryYieldRate` on the account level; this is per-holding. |
| `taxCostRatio`          | `real`            | Morningstar's tax cost ratio: the percentage of return surrendered to taxes annually. Directly comparable across funds. Source: Morningstar API or manual entry. |

### G.2 New Table: `taxLots`

For precise tax-loss harvesting, the system needs lot-level data rather than aggregate cost basis.

| Field Name       | Type              | Description |
|------------------|-------------------|-------------|
| `id`             | `uuid` (PK)       | Unique lot identifier |
| `holdingId`      | `text` (FK)        | References `accountHoldings.id` |
| `userId`         | `text` (FK)        | References `userProfiles.id` |
| `acquiredDate`   | `timestamp`        | Date this specific lot was purchased |
| `shares`         | `decimal(18,6)`    | Number of shares in this lot |
| `costBasisPerShare` | `decimal(18,6)` | Per-share cost basis for this lot |
| `totalCostBasis` | `decimal(18,6)`    | `shares * costBasisPerShare` |
| `isWashSaleAdjusted` | `boolean`      | Whether this lot's basis was adjusted due to a prior wash sale |

Tax lot data enables:
- **Specific identification** method for tax-loss harvesting (sell the highest-cost lots first to maximize realized losses)
- **Holding period** determination per lot (STCG vs. LTCG)
- **Wash sale** basis adjustment tracking

### G.3 New Table: `taxLossHarvestLog`

Track executed harvests for wash-sale compliance and carryforward tracking.

| Field Name         | Type              | Description |
|--------------------|-------------------|-------------|
| `id`               | `uuid` (PK)       | Unique harvest event identifier |
| `userId`           | `text` (FK)        | References `userProfiles.id` |
| `holdingId`        | `text` (FK)        | The holding that was sold |
| `ticker`           | `text`             | Ticker of the sold security |
| `saleDate`         | `timestamp`        | Date the loss was realized |
| `sharesHarvested`  | `decimal(18,6)`    | Number of shares sold |
| `realizedLoss`     | `decimal(18,6)`    | Dollar amount of the realized loss (positive number) |
| `gainCharacter`    | `text`             | `"short_term"` or `"long_term"` |
| `replacementTicker`| `text`             | The ticker purchased as a replacement |
| `washSaleWindowEnd`| `timestamp`        | `saleDate + 30 calendar days`; do not repurchase original ticker before this date |
| `status`           | `text`             | `"active"` (within wash-sale window) or `"cleared"` |

### G.4 Addition to `userProfiles` Table

| Field Name               | Type         | Description |
|--------------------------|--------------|-------------|
| `capitalLossCarryforward`| `real`       | Cumulative unused capital loss carryforward from prior years. Updated annually after tax-loss harvesting reconciliation. Per IRC Section 1212(b), this carries forward indefinitely. |

### G.5 Additions to `investmentAccounts` Table

| Field Name              | Type    | Description |
|-------------------------|---------|-------------|
| `assetLocationScore`    | `real`  | Computed optimization score (0.0 to 1.0) indicating how well the account's current holdings match the optimal asset location strategy for its account type. 1.0 = perfectly located; 0.0 = entirely mislocated. |
| `taxDragEstimate`       | `real`  | Estimated annual tax drag as a percentage of account value, based on the holdings' income types and the account's tax treatment. |

---

## H. Integration Points with Existing Codebase

### H.1 Tax Engine (`src/server/simulation/tax/`)

The optimization layer reads from but does not modify the tax engine. Key integration:
- `getMarginalOrdinaryRate()` and `getMarginalLtcgRate()` drive the muni breakeven calculation and harvesting value estimation
- `calculateFederalTax()` provides the NIIT computation
- `NIIT_THRESHOLD` and `NIIT_RATE` constants are used for exposure monitoring

### H.2 Recommendation Engine (`src/server/portfolios/recommendation-engine.ts`)

The existing AI-powered recommendation engine generates INCREASE/DECREASE/HOLD/REPLACE/SELL recommendations. The tax optimization layer should:
- Add the `"HARVEST"` action type
- Include tax context in the AI prompt (user's marginal rates, account type, unrealized gain/loss)
- Weight recommendations by after-tax return rather than pre-tax return

### H.3 Tax Center UI (`src/components/tax/`)

Existing components (`tax-center.tsx`, `tax-summary-cards.tsx`, `bracket-heatmap.tsx`, `tax-timeline-chart.tsx`) provide the UI framework. New panels needed:
- Asset location scorecard
- Tax-loss harvesting opportunities list
- NIIT exposure monitor
- Muni bond breakeven calculator

### H.4 Simulation Engine (`src/server/simulation/engine/quarterly-engine.ts`)

The quarterly simulation engine should incorporate tax-loss harvesting events as discrete cash flow events, reducing projected tax liability in the year of harvest and carrying forward unused losses.

---

## I. IRS Authority References

| Topic                        | IRS Authority                              |
|------------------------------|--------------------------------------------|
| LTCG holding period          | IRC Section 1222                           |
| Capital loss limitation      | IRC Section 1211(b) ($3,000/yr MFJ)       |
| Capital loss carryforward    | IRC Section 1212(b)                        |
| Wash sale rule               | IRC Section 1091                           |
| Municipal bond exclusion     | IRC Section 103                            |
| NIIT                         | IRC Section 1411; Treas. Reg. 1.1411       |
| NIIT muni exclusion          | Treas. Reg. 1.1411-1(d)(4)                |
| Qualified dividends          | IRC Section 1(h)(11)                       |
| Roth distribution rules      | IRC Section 408A(d)                        |
| Traditional IRA taxation     | IRC Section 408(d)                         |
| 401(k) distribution taxation | IRC Section 402(a)                         |
| Stepped-up basis at death    | IRC Section 1014                           |
| Treasury state tax exemption | 31 USC Section 3124                        |
| Qualified Opportunity Zones  | IRC Section 1400Z-2                        |
| Installment sales            | IRC Section 453                            |
| Depreciation recapture       | IRC Section 1250                           |
| 2025 inflation adjustments   | IRS Rev. Proc. 2024-40                     |
